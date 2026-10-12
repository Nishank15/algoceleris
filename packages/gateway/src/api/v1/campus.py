import csv
from datetime import datetime, timezone
import io
import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...auth.rbac import get_current_user
from ...auth.security import hash_password
from ...core.assessment_engine import (
    compute_late_penalty,
    mask_test_case_results,
    resolve_assessment_status,
    validate_submission_gatekeeper,
)
from ...core.campus_rbac import (
    require_instructor,
    require_org_admin,
    require_student,
)
from ...core.proctoring_mesh import get_proctoring_mesh_store
from ...database import get_db
from ...models.campus import (
    Assessment,
    AssessmentMode,
    AssessmentStatus,
    AssessmentSubmission,
    CampusRole,
    Cohort,
    InterviewRoom,
    MembershipStatus,
    OrgMembership,
    Organization,
    ProctorEvent,
)
from ...models.entities import Submission, User

logger = logging.getLogger("cloudjudge.api.v1.campus")

router = APIRouter(prefix="/campus", tags=["campus"])


# --- Schemas ---

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100)
    domain_whitelist: List[str] = Field(default_factory=list)
    branding_config: Dict[str, Any] = Field(default_factory=dict)


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    domain_whitelist: List[str]
    branding_config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CohortCreate(BaseModel):
    org_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    term: str = Field(..., min_length=1, max_length=50)
    is_active: bool = True


class CohortResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    code: str
    term: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RosterMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    email: str
    role: str
    status: str
    cohort_id: Optional[uuid.UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BatchMemberItem(BaseModel):
    email: str
    role: str = CampusRole.STUDENT.value
    cohort_id: Optional[uuid.UUID] = None
    username: Optional[str] = None


class BatchIngestRequest(BaseModel):
    members: Optional[List[BatchMemberItem]] = None
    csv_content: Optional[str] = None


class BatchIngestResponse(BaseModel):
    imported_count: int
    members: List[RosterMemberResponse]


class AssessmentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(...)
    mode: str = AssessmentMode.EXAM.value
    problem_slugs: List[str] = Field(default_factory=list)
    scoring_rubric: Dict[str, Any] = Field(default_factory=dict)
    publish_at: datetime
    starts_at: datetime
    due_at: datetime
    cutoff_at: datetime
    duration_minutes: Optional[int] = None
    late_penalty_percent_per_hour: float = 0.0
    max_late_penalty_percent: float = 100.0
    proctoring_config: Dict[str, Any] = Field(default_factory=dict)
    status: str = AssessmentStatus.DRAFT.value


class AssessmentResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    cohort_id: uuid.UUID
    title: str
    description: str
    mode: str
    status: str
    problem_slugs: List[str]
    scoring_rubric: Dict[str, Any]
    publish_at: datetime
    starts_at: datetime
    due_at: datetime
    cutoff_at: datetime
    duration_minutes: Optional[int] = None
    late_penalty_percent_per_hour: float
    max_late_penalty_percent: float
    proctoring_config: Dict[str, Any]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AssessmentStatusUpdate(BaseModel):
    status: str


class AssessmentSubmitRequest(BaseModel):
    raw_score: float
    problem_slug: Optional[str] = None
    language: Optional[str] = "python"
    source_code: Optional[str] = ""
    submission_id: Optional[uuid.UUID] = None
    submitted_at: Optional[datetime] = None
    test_cases: Optional[List[Dict[str, Any]]] = None


class AssessmentSubmissionResponse(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    user_id: uuid.UUID
    submission_id: uuid.UUID
    raw_score: float
    late_penalty_deduction: float
    final_score: float
    is_late: bool
    eval_verdict: str
    submitted_at: datetime
    proctor_events_count: int = 0
    feedback_notes: Optional[str] = None
    test_case_results: Optional[List[Dict[str, Any]]] = None
    is_grades_released: bool = False
    model_config = ConfigDict(from_attributes=True)


class GradeReleaseResponse(BaseModel):
    status: str = "success"
    grades_released: bool = True
    assessment_id: uuid.UUID
    message: str = "Grades released successfully"


class ProctorEventResponse(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    user_id: uuid.UUID
    event_type: str
    severity: str
    event_metadata: Dict[str, Any]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VivaProvisionRequest(BaseModel):
    candidate_user_id: uuid.UUID
    problem_slug: Optional[str] = None
    language: Optional[str] = "python"
    initial_code: Optional[str] = ""


class VivaRubricUpdateRequest(BaseModel):
    rubric_scores: Optional[Dict[str, Any]] = None
    interviewer_notes: Optional[str] = None
    status: Optional[str] = None


class VivaRoomResponse(BaseModel):
    id: uuid.UUID
    room_code: str
    org_id: Optional[uuid.UUID] = None
    assessment_id: Optional[uuid.UUID] = None
    host_user_id: uuid.UUID
    candidate_user_id: uuid.UUID
    problem_slug: str
    language: str
    status: str
    editor_code: str
    interviewer_notes: Optional[str] = None
    rubric_scores: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Helper Methods ---

async def _create_cohort_record(
    data: CohortCreate,
    target_org_id: uuid.UUID,
    db: AsyncSession,
) -> CohortResponse:
    # Ensure organization exists
    org = await db.get(Organization, target_org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{target_org_id}' not found",
        )

    # Check unique constraint on [org_id, code]
    stmt = select(Cohort).where(
        Cohort.org_id == target_org_id,
        Cohort.code == data.code,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cohort code '{data.code}' already exists in organization",
        )

    cohort = Cohort(
        id=uuid.uuid4(),
        org_id=target_org_id,
        name=data.name,
        code=data.code,
        term=data.term,
        is_active=data.is_active,
    )
    db.add(cohort)
    await db.commit()
    await db.refresh(cohort)
    return CohortResponse.model_validate(cohort)


# --- Organization Endpoints ---

@router.post(
    "/orgs",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create organization tenant and enroll creator as org_admin",
)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    # Check slug uniqueness
    stmt = select(Organization).where(Organization.slug == data.slug)
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organization with slug '{data.slug}' already exists",
        )

    org = Organization(
        id=uuid.uuid4(),
        name=data.name,
        slug=data.slug,
        domain_whitelist=data.domain_whitelist,
        branding_config=data.branding_config,
    )
    db.add(org)
    await db.flush()

    # Automatically enroll creator as active org_admin
    membership = OrgMembership(
        id=uuid.uuid4(),
        org_id=org.id,
        user_id=current_user.id,
        role=CampusRole.ORG_ADMIN.value,
        status=MembershipStatus.ACTIVE.value,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(org)
    return OrganizationResponse.model_validate(org)


@router.get(
    "/orgs/{org_id}",
    response_model=OrganizationResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve organization tenant details (tenant member access only)",
    dependencies=[Depends(require_student)],
)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{org_id}' not found",
        )
    return OrganizationResponse.model_validate(org)


# --- Cohort Endpoints ---

@router.post(
    "/cohorts",
    response_model=CohortResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cohort with org_id in body (requires instructor or org_admin)",
    dependencies=[Depends(require_instructor)],
)
async def create_cohort(
    data: CohortCreate,
    db: AsyncSession = Depends(get_db),
) -> CohortResponse:
    if not data.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="org_id must be provided in request body",
        )
    return await _create_cohort_record(data, data.org_id, db)


@router.post(
    "/orgs/{org_id}/cohorts",
    response_model=CohortResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cohort with org_id in path (requires instructor or org_admin)",
    dependencies=[Depends(require_instructor)],
)
async def create_cohort_for_org(
    org_id: uuid.UUID,
    data: CohortCreate,
    db: AsyncSession = Depends(get_db),
) -> CohortResponse:
    return await _create_cohort_record(data, org_id, db)


@router.get(
    "/cohorts/{cohort_id}/roster",
    response_model=List[RosterMemberResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve student roster enrolled in cohort",
    dependencies=[Depends(require_instructor)],
)
async def get_cohort_roster(
    cohort_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> List[RosterMemberResponse]:
    stmt = (
        select(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .where(
            OrgMembership.cohort_id == cohort_id,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        .order_by(User.email.asc())
    )
    result = await db.execute(stmt)
    records = result.all()

    roster: List[RosterMemberResponse] = []
    for membership, user in records:
        roster.append(
            RosterMemberResponse(
                id=membership.id,
                user_id=user.id,
                username=user.username,
                email=user.email,
                role=membership.role,
                status=membership.status,
                cohort_id=membership.cohort_id,
                created_at=membership.created_at,
            )
        )
    return roster


# --- Batch Ingestion Endpoints ---

@router.post(
    "/orgs/{org_id}/members/batch",
    response_model=BatchIngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch member ingestion with domain whitelist validation and seat quota rollback",
    dependencies=[Depends(require_org_admin)],
)
async def batch_ingest_members(
    org_id: uuid.UUID,
    request: BatchIngestRequest,
    db: AsyncSession = Depends(get_db),
) -> BatchIngestResponse:
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{org_id}' not found",
        )

    # 1. Parse members from JSON payload or CSV string
    items: List[BatchMemberItem] = []
    if request.members:
        items.extend(request.members)
    elif request.csv_content:
        f = io.StringIO(request.csv_content.strip())
        reader = csv.DictReader(f)
        for row in reader:
            email = row.get("email", "").strip()
            if not email:
                continue
            role = row.get("role", CampusRole.STUDENT.value).strip()
            cohort_raw = row.get("cohort_id", "").strip()
            c_uuid = uuid.UUID(cohort_raw) if cohort_raw else None
            username = row.get("username", "").strip() or None
            items.append(
                BatchMemberItem(
                    email=email,
                    role=role,
                    cohort_id=c_uuid,
                    username=username,
                )
            )

    if not items:
        return BatchIngestResponse(imported_count=0, members=[])

    # 2. Domain Whitelist Validation
    allowed_domains = [d.lower() for d in (org.domain_whitelist or [])]
    if allowed_domains:
        for item in items:
            email = item.email.strip().lower()
            domain = email.split("@")[-1] if "@" in email else ""
            if not any(domain == d or domain.endswith("." + d) for d in allowed_domains):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "domain_whitelist_violation",
                        "message": f"Email '{item.email}' domain does not match organization whitelist {org.domain_whitelist}",
                        "email": item.email,
                    },
                )

    # 3. Quota Overflow Validation & Rollback
    branding = org.branding_config or {}
    max_seats = branding.get("max_seats") or branding.get("seat_quota")
    if max_seats is not None:
        stmt_count = select(func.count(OrgMembership.id)).where(
            OrgMembership.org_id == org_id,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        curr_seats = (await db.execute(stmt_count)).scalar_one()
        if curr_seats + len(items) > int(max_seats):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "seat_quota_exceeded",
                    "message": f"Batch ingestion exceeds seat quota ({curr_seats + len(items)} > {max_seats})",
                    "max_seats": int(max_seats),
                    "current_members": curr_seats,
                    "requested": len(items),
                },
            )

    # 4. Atomic Ingestion
    imported_responses: List[RosterMemberResponse] = []
    for item in items:
        # Check or create User
        stmt_user = select(User).where(User.email == item.email)
        user = (await db.execute(stmt_user)).scalars().first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                username=item.username or f"{item.email.split('@')[0]}_{uuid.uuid4().hex[:6]}",
                email=item.email,
                password_hash=hash_password("TemporaryCampusPassword123!"),
                account_type="free",
            )
            db.add(user)
            await db.flush()

        # Check or create OrgMembership
        stmt_m = select(OrgMembership).where(
            OrgMembership.org_id == org_id,
            OrgMembership.user_id == user.id,
        )
        membership = (await db.execute(stmt_m)).scalars().first()
        if not membership:
            membership = OrgMembership(
                id=uuid.uuid4(),
                org_id=org_id,
                user_id=user.id,
                cohort_id=item.cohort_id,
                role=item.role,
                status=MembershipStatus.ACTIVE.value,
            )
            db.add(membership)
            await db.flush()
        else:
            membership.role = item.role
            if item.cohort_id is not None:
                membership.cohort_id = item.cohort_id
            membership.status = MembershipStatus.ACTIVE.value

        imported_responses.append(
            RosterMemberResponse(
                id=membership.id,
                user_id=user.id,
                username=user.username,
                email=user.email,
                role=membership.role,
                status=membership.status,
                cohort_id=membership.cohort_id,
                created_at=membership.created_at or datetime.now(timezone.utc),
            )
        )

    await db.commit()
    return BatchIngestResponse(
        imported_count=len(imported_responses),
        members=imported_responses,
    )


# --- Assessment Lifecycle Endpoints ---

@router.post(
    "/cohorts/{cohort_id}/assessments",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create institutional assessment in cohort (requires instructor or org_admin)",
    dependencies=[Depends(require_instructor)],
)
async def create_assessment(
    cohort_id: uuid.UUID,
    data: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    cohort = await db.get(Cohort, cohort_id)
    if not cohort:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cohort '{cohort_id}' not found",
        )

    # Validate timeline ordering
    if not (data.publish_at <= data.starts_at <= data.due_at <= data.cutoff_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timeline violation: publish_at <= starts_at <= due_at <= cutoff_at required",
        )

    assessment = Assessment(
        id=uuid.uuid4(),
        org_id=cohort.org_id,
        cohort_id=cohort.id,
        title=data.title,
        description=data.description,
        mode=data.mode,
        status=data.status,
        problem_slugs=data.problem_slugs,
        scoring_rubric=data.scoring_rubric,
        publish_at=data.publish_at,
        starts_at=data.starts_at,
        due_at=data.due_at,
        cutoff_at=data.cutoff_at,
        duration_minutes=data.duration_minutes,
        late_penalty_percent_per_hour=data.late_penalty_percent_per_hour,
        max_late_penalty_percent=data.max_late_penalty_percent,
        proctoring_config=data.proctoring_config,
        created_by=current_user.id,
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return AssessmentResponse.model_validate(assessment)


@router.get(
    "/cohorts/{cohort_id}/assessments",
    response_model=List[AssessmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List assessments for cohort with dynamic status resolution",
)
async def list_cohort_assessments(
    cohort_id: uuid.UUID,
    membership: OrgMembership = Depends(require_student),
    db: AsyncSession = Depends(get_db),
) -> List[AssessmentResponse]:
    stmt = (
        select(Assessment)
        .where(Assessment.cohort_id == cohort_id)
        .order_by(Assessment.starts_at.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()
    out: List[AssessmentResponse] = []
    for a in records:
        dyn_status = resolve_assessment_status(
            manual_status=a.status,
            publish_at=a.publish_at,
            starts_at=a.starts_at,
            due_at=a.due_at,
            cutoff_at=a.cutoff_at,
        )
        if str(membership.role) == CampusRole.STUDENT.value and (
            a.status == AssessmentStatus.DRAFT.value
            or dyn_status == AssessmentStatus.DRAFT.value
        ):
            continue
        resp = AssessmentResponse.model_validate(a)
        resp.status = dyn_status
        out.append(resp)
    return out


@router.get(
    "/assessments",
    response_model=List[AssessmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List all accessible assessments for the current user's organizations",
)
async def list_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[AssessmentResponse]:
    # Find user memberships
    m_stmt = select(OrgMembership).where(
        OrgMembership.user_id == current_user.id,
        OrgMembership.status == MembershipStatus.ACTIVE.value,
    )
    memberships = (await db.execute(m_stmt)).scalars().all()
    if not memberships:
        return []

    org_ids = [m.org_id for m in memberships]
    stmt = (
        select(Assessment)
        .where(Assessment.org_id.in_(org_ids))
        .order_by(Assessment.starts_at.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # Build role map per org/cohort
    is_admin_or_instructor = any(
        m.role in (CampusRole.ORG_ADMIN.value, CampusRole.INSTRUCTOR.value)
        for m in memberships
    )

    out: List[AssessmentResponse] = []
    for a in records:
        dyn_status = resolve_assessment_status(
            manual_status=a.status,
            publish_at=a.publish_at,
            starts_at=a.starts_at,
            due_at=a.due_at,
            cutoff_at=a.cutoff_at,
        )
        if not is_admin_or_instructor and (
            a.status == AssessmentStatus.DRAFT.value
            or dyn_status == AssessmentStatus.DRAFT.value
        ):
            continue
        resp = AssessmentResponse.model_validate(a)
        resp.status = dyn_status
        out.append(resp)
    return out


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve assessment details with dynamic status resolution and role visibility filtering",
)
async def get_assessment(
    assessment_id: uuid.UUID,
    membership: OrgMembership = Depends(require_student),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    dyn_status = resolve_assessment_status(
        manual_status=assessment.status,
        publish_at=assessment.publish_at,
        starts_at=assessment.starts_at,
        due_at=assessment.due_at,
        cutoff_at=assessment.cutoff_at,
    )

    # Role visibility filtering: DRAFT is hidden from students
    if str(membership.role) == CampusRole.STUDENT.value and (
        assessment.status == AssessmentStatus.DRAFT.value
        or dyn_status == AssessmentStatus.DRAFT.value
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    resp = AssessmentResponse.model_validate(assessment)
    resp.status = dyn_status
    return resp


@router.patch(
    "/assessments/{assessment_id}/status",
    response_model=AssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Manual status override (e.g. publish, close) (requires instructor or org_admin)",
    dependencies=[Depends(require_instructor)],
)
async def update_assessment_status(
    assessment_id: uuid.UUID,
    data: AssessmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    valid_statuses = {s.value for s in AssessmentStatus}
    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{data.status}'. Valid statuses: {valid_statuses}",
        )

    assessment.status = data.status
    await db.commit()
    await db.refresh(assessment)

    dyn_status = resolve_assessment_status(
        manual_status=assessment.status,
        publish_at=assessment.publish_at,
        starts_at=assessment.starts_at,
        due_at=assessment.due_at,
        cutoff_at=assessment.cutoff_at,
    )
    resp = AssessmentResponse.model_validate(assessment)
    resp.status = dyn_status
    return resp


@router.post(
    "/assessments/{assessment_id}/submit",
    response_model=AssessmentSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit assessment attempt with deadline gatekeeper validation and late penalty calculation",
)
async def submit_assessment(
    assessment_id: uuid.UUID,
    data: AssessmentSubmitRequest,
    membership: OrgMembership = Depends(require_student),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentSubmissionResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    sub_time = data.submitted_at or datetime.now(timezone.utc)

    # 1. Validate submission window gatekeeper (raises 403 on premature or post-cutoff)
    validate_submission_gatekeeper(assessment, submitted_at=sub_time)

    # 2. Compute late penalty deduction
    penalty_res = compute_late_penalty(
        raw_score=data.raw_score,
        due_at=assessment.due_at,
        submitted_at=sub_time,
        late_penalty_percent_per_hour=assessment.late_penalty_percent_per_hour,
        max_late_penalty_percent=assessment.max_late_penalty_percent,
    )

    # 3. Create or link base submission
    sub_id = data.submission_id
    if not sub_id:
        slug = data.problem_slug or (assessment.problem_slugs[0] if assessment.problem_slugs else "problem")
        base_sub = Submission(
            id=uuid.uuid4(),
            user_id=current_user.id,
            problem_slug=slug,
            language=data.language or "python",
            code=data.source_code or "",
            verdict="ACCEPTED",
            assessment_id=assessment.id,
        )
        db.add(base_sub)
        await db.flush()
        sub_id = base_sub.id

    # 4. Persist AssessmentSubmission
    raw_test_cases = data.test_cases or []
    feedback_payload = json.dumps(raw_test_cases) if raw_test_cases else None

    record = AssessmentSubmission(
        id=uuid.uuid4(),
        assessment_id=assessment.id,
        user_id=current_user.id,
        submission_id=sub_id,
        raw_score=data.raw_score,
        late_penalty_deduction=penalty_res["late_penalty_deduction"],
        final_score=penalty_res["final_score"],
        is_late=penalty_res["is_late"],
        submitted_at=sub_time,
        eval_verdict="ACCEPTED",
        feedback_notes=feedback_payload,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    rubric = assessment.scoring_rubric or {}
    is_grades_released = bool(rubric.get("grades_released", False))
    is_faculty = str(membership.role) in (CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value)

    masked_results = mask_test_case_results(
        raw_test_cases,
        is_instructor=is_faculty,
        is_grades_released=is_grades_released,
    ) if raw_test_cases else None

    resp = AssessmentSubmissionResponse.model_validate(record)
    resp.test_case_results = masked_results
    resp.is_grades_released = is_grades_released
    return resp


@router.get(
    "/assessments/{assessment_id}/submissions/{submission_id}",
    response_model=AssessmentSubmissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve assessment submission details with secret test masking",
)
async def get_assessment_submission(
    assessment_id: uuid.UUID,
    submission_id: uuid.UUID,
    membership: OrgMembership = Depends(require_student),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentSubmissionResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    stmt = select(AssessmentSubmission).where(
        AssessmentSubmission.id == submission_id,
        AssessmentSubmission.assessment_id == assessment_id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment submission '{submission_id}' not found",
        )

    is_faculty = str(membership.role) in (CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value)
    if not is_faculty and record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view another student's submission",
        )

    rubric = assessment.scoring_rubric or {}
    is_grades_released = bool(rubric.get("grades_released", False))

    raw_test_cases = []
    if record.feedback_notes:
        try:
            raw_test_cases = json.loads(record.feedback_notes)
        except Exception:
            raw_test_cases = []

    masked_results = mask_test_case_results(
        raw_test_cases,
        is_instructor=is_faculty,
        is_grades_released=is_grades_released,
    ) if raw_test_cases else None

    resp = AssessmentSubmissionResponse.model_validate(record)
    resp.test_case_results = masked_results
    resp.is_grades_released = is_grades_released
    return resp


@router.post(
    "/assessments/{assessment_id}/release-grades",
    response_model=GradeReleaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Release grades and unmask diagnostic test cases for an assessment (requires instructor)",
    dependencies=[Depends(require_instructor)],
)
async def release_assessment_grades(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> GradeReleaseResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    rubric = dict(assessment.scoring_rubric or {})
    rubric["grades_released"] = True
    assessment.scoring_rubric = rubric
    assessment.status = AssessmentStatus.CLOSED.value
    await db.commit()

    return GradeReleaseResponse(
        status="success",
        grades_released=True,
        assessment_id=assessment.id,
        message="Grades and diagnostics released successfully",
    )


@router.get(
    "/assessments/{assessment_id}/proctor/students",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Retrieve active proctored students and live risk scores (requires instructor)",
    dependencies=[Depends(require_instructor)],
)
async def get_assessment_proctored_students(
    assessment_id: uuid.UUID,
) -> List[Dict[str, Any]]:
    mesh_store = get_proctoring_mesh_store()
    return mesh_store.get_active_students(assessment_id)


@router.get(
    "/assessments/{assessment_id}/proctor/events",
    response_model=List[ProctorEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve logged proctoring anomaly events for assessment (requires instructor)",
    dependencies=[Depends(require_instructor)],
)
async def get_assessment_proctor_events(
    assessment_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
) -> List[ProctorEventResponse]:
    stmt = select(ProctorEvent).where(ProctorEvent.assessment_id == assessment_id)
    if user_id:
        stmt = stmt.where(ProctorEvent.user_id == user_id)
    stmt = stmt.order_by(ProctorEvent.created_at.desc())
    events = (await db.execute(stmt)).scalars().all()
    return [ProctorEventResponse.model_validate(e) for e in events]


# --- Viva Interview Endpoints ---

@router.post(
    "/assessments/{assessment_id}/viva/provision",
    response_model=VivaRoomResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision a real-time multiplayer Viva room for candidate (requires instructor)",
    dependencies=[Depends(require_instructor)],
)
async def provision_viva_room(
    assessment_id: uuid.UUID,
    data: VivaProvisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VivaRoomResponse:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found",
        )

    cand_user = await db.get(User, data.candidate_user_id)
    if not cand_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate user '{data.candidate_user_id}' not found",
        )

    slug = data.problem_slug or (assessment.problem_slugs[0] if assessment.problem_slugs else "problem")
    room_code = f"viva-{uuid.uuid4().hex[:8]}"

    room = InterviewRoom(
        id=uuid.uuid4(),
        org_id=assessment.org_id,
        assessment_id=assessment.id,
        room_code=room_code,
        host_user_id=current_user.id,
        candidate_user_id=data.candidate_user_id,
        problem_slug=slug,
        language=data.language or "python",
        status="WAITING",
        editor_code=data.initial_code or "",
        interviewer_notes="",
        rubric_scores={},
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return VivaRoomResponse.model_validate(room)


@router.get(
    "/viva/{room_code}",
    response_model=VivaRoomResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Viva room details with role-aware private rubric masking",
)
async def get_viva_room(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VivaRoomResponse:
    stmt = select(InterviewRoom).where(InterviewRoom.room_code == room_code)
    room = (await db.execute(stmt)).scalars().first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Viva room '{room_code}' not found",
        )

    is_host = (room.host_user_id == current_user.id)
    is_candidate = (room.candidate_user_id == current_user.id)

    # Check organization instructor role
    if not is_host and not is_candidate and room.org_id:
        stmt_mem = select(OrgMembership).where(
            OrgMembership.org_id == room.org_id,
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        membership = (await db.execute(stmt_mem)).scalars().first()
        if membership and str(membership.role) in (CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value):
            is_host = True

    if not is_host and not is_candidate:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to viva room",
        )

    resp = VivaRoomResponse.model_validate(room)
    # Mask private rubric scoring details for the candidate
    if is_candidate and not is_host:
        resp.rubric_scores = {}
        resp.interviewer_notes = None

    return resp


@router.patch(
    "/viva/{room_code}/rubric",
    response_model=VivaRoomResponse,
    status_code=status.HTTP_200_OK,
    summary="Update private rubric grading criteria and notes (requires instructor)",
)
async def update_viva_rubric(
    room_code: str,
    data: VivaRubricUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VivaRoomResponse:
    stmt = select(InterviewRoom).where(InterviewRoom.room_code == room_code)
    room = (await db.execute(stmt)).scalars().first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Viva room '{room_code}' not found",
        )

    is_host = (room.host_user_id == current_user.id)
    if not is_host and room.org_id:
        stmt_mem = select(OrgMembership).where(
            OrgMembership.org_id == room.org_id,
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        membership = (await db.execute(stmt_mem)).scalars().first()
        if membership and str(membership.role) in (CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value):
            is_host = True

    if not is_host:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "insufficient_campus_permissions",
                "message": "Instructor privileges required to update viva rubric",
            },
        )

    if data.rubric_scores is not None:
        room.rubric_scores = dict(data.rubric_scores)
    if data.interviewer_notes is not None:
        room.interviewer_notes = data.interviewer_notes
    if data.status is not None:
        room.status = data.status

    await db.commit()
    await db.refresh(room)
    return VivaRoomResponse.model_validate(room)

