import logging
from typing import Any, Optional, Union
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.rbac import get_current_user
from ..database import get_db
from ..models.campus import Assessment, CampusRole, Cohort, MembershipStatus, OrgMembership
from ..models.entities import User

logger = logging.getLogger("cloudjudge.core.campus_rbac")

ROLE_LEVELS = {
    CampusRole.STUDENT.value: 10,
    CampusRole.TEACHING_ASSISTANT.value: 20,
    CampusRole.INSTRUCTOR.value: 30,
    CampusRole.ORG_ADMIN.value: 40,
}


class CampusRoleChecker:
    """Dependency checker enforcing organization-scoped campus RBAC hierarchies."""

    def __init__(self, required_role: CampusRole):
        self.required_role = required_role

    async def __call__(
        self,
        request: Request,
        org_id: Optional[Union[str, uuid.UUID]] = None,
        cohort_id: Optional[Union[str, uuid.UUID]] = None,
        assessment_id: Optional[Union[str, uuid.UUID]] = None,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> OrgMembership:
        target_org_id = org_id or request.path_params.get("org_id")
        if not target_org_id:
            target_org_id = (
                request.headers.get("x-org-id")
                or request.headers.get("X-Org-ID")
                or request.headers.get("X-Org-Id")
                or request.query_params.get("org_id")
            )

        # If org_id is not provided, resolve via cohort_id if present
        if not target_org_id:
            target_cohort_id = cohort_id or request.path_params.get("cohort_id") or request.query_params.get("cohort_id")
            if target_cohort_id:
                try:
                    c_uuid = uuid.UUID(str(target_cohort_id))
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid cohort_id format",
                    )
                stmt = select(Cohort).where(Cohort.id == c_uuid)
                result = await db.execute(stmt)
                cohort = result.scalars().first()
                if not cohort:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Cohort not found",
                    )
                target_org_id = cohort.org_id

        # If org_id is not provided, resolve via assessment_id if present
        if not target_org_id:
            target_assessment_id = assessment_id or request.path_params.get("assessment_id") or request.query_params.get("assessment_id")
            if target_assessment_id:
                try:
                    a_uuid = uuid.UUID(str(target_assessment_id))
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid assessment_id format",
                    )
                stmt = select(Assessment).where(Assessment.id == a_uuid)
                result = await db.execute(stmt)
                assessment = result.scalars().first()
                if not assessment:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Assessment not found",
                    )
                target_org_id = assessment.org_id

        # If still not found and request has a JSON body, attempt extraction
        if not target_org_id and request.method in {"POST", "PUT", "PATCH"}:
            try:
                body = await request.json()
                if isinstance(body, dict) and "org_id" in body:
                    target_org_id = body["org_id"]
            except Exception:
                pass

        if not target_org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization context required (org_id or cohort_id missing)",
            )

        try:
            org_uuid = uuid.UUID(str(target_org_id))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid org_id format",
            )

        # Query membership for current user in the organization
        stmt = select(OrgMembership).where(
            OrgMembership.org_id == org_uuid,
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        result = await db.execute(stmt)
        membership = result.scalars().first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_campus_permissions",
                    "required_role": self.required_role.value,
                    "user_role": None,
                    "message": f"User is not a member of organization {org_uuid}",
                },
            )

        user_level = ROLE_LEVELS.get(str(membership.role), 0)
        required_level = ROLE_LEVELS.get(self.required_role.value, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_campus_permissions",
                    "required_role": self.required_role.value,
                    "user_role": str(membership.role),
                    "message": f"Required role {self.required_role.value}, but user has role {membership.role}",
                },
            )

        return membership


require_org_admin = CampusRoleChecker(CampusRole.ORG_ADMIN)
require_instructor = CampusRoleChecker(CampusRole.INSTRUCTOR)
require_teaching_assistant = CampusRoleChecker(CampusRole.TEACHING_ASSISTANT)
require_student = CampusRoleChecker(CampusRole.STUDENT)
