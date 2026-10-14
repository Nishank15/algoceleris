use std::sync::Arc;

use judge_viva::{
    AwarenessEnvelope, AwarenessMessage, CursorPosition, PeerPresence, VivaDoc, VivaError,
    VivaRoomManager,
};
use uuid::Uuid;

#[test]
fn test_yrs_crdt_convergence() -> Result<(), VivaError> {
    let doc_a = VivaDoc::with_initial_code("fn main() {\n}\n");
    let doc_b = VivaDoc::new();

    // 1. Initial synchronisation
    let initial_update = doc_a.encode_update_v1();
    doc_b.apply_client_update(&initial_update)?;
    assert_eq!(doc_a.export_code_snapshot(), doc_b.export_code_snapshot());

    // 2. Perform concurrent edits
    // Peer A inserts at index 12 (inside main)
    doc_a.insert_text(12, "    println!(\"Peer A\");\n");

    // Peer B inserts at index 12 (inside main)
    doc_b.insert_text(12, "    println!(\"Peer B\");\n");

    // Snapshot before sync
    let text_a = doc_a.export_code_snapshot();
    let text_b = doc_b.export_code_snapshot();
    assert_ne!(text_a, text_b);

    // 3. Exchange updates
    let sv_a = doc_a.state_vector_v1();
    let sv_b = doc_b.state_vector_v1();

    let diff_for_b = doc_a.generate_diff_for_client(&sv_b)?;
    let diff_for_a = doc_b.generate_diff_for_client(&sv_a)?;

    doc_b.apply_client_update(&diff_for_b)?;
    doc_a.apply_client_update(&diff_for_a)?;

    // 4. Assert strict convergence
    let final_a = doc_a.export_code_snapshot();
    let final_b = doc_b.export_code_snapshot();
    assert_eq!(
        final_a, final_b,
        "concurrent edits must converge to identical snapshots"
    );

    // Both edits must be present in the converged output
    assert!(final_a.contains("Peer A"));
    assert!(final_a.contains("Peer B"));

    Ok(())
}

#[test]
fn test_state_vector_diff_exchange() -> Result<(), VivaError> {
    let doc_server = VivaDoc::with_initial_code("let x = 42;");
    let doc_client = VivaDoc::new();

    // Step 1: Client sends StateVector
    let client_sv = doc_client.state_vector_v1();

    // Step 2: Server generates diff update for client
    let sync_step2_diff = doc_server.generate_diff_for_client(&client_sv)?;

    // Client applies update
    doc_client.apply_client_update(&sync_step2_diff)?;
    assert_eq!(doc_client.export_code_snapshot(), "let x = 42;");

    // Client makes additional edit
    doc_client.insert_text(11, "\nlet y = 100;");

    // Client provides update diff back to server
    let server_sv = doc_server.state_vector_v1();
    let client_diff = doc_client.generate_diff_for_client(&server_sv)?;
    doc_server.apply_client_update(&client_diff)?;

    // Both documents must be in identical state
    assert_eq!(
        doc_server.export_code_snapshot(),
        doc_client.export_code_snapshot()
    );
    assert_eq!(doc_server.export_code_snapshot(), "let x = 42;\nlet y = 100;");

    Ok(())
}

#[test]
fn test_awareness_envelope_serialization() -> Result<(), VivaError> {
    let user_id = Uuid::new_v4();
    let cursor = CursorPosition::new(15, 30);
    let presence = PeerPresence::new(
        user_id,
        "alice_candidate",
        "candidate",
        Some(cursor),
        "#e4f222",
    );

    // 1. Presence update envelope
    let env_presence = AwarenessEnvelope::presence_update("VIVA-401", presence.clone());
    let json_presence = env_presence.to_json()?;
    let decoded_presence = AwarenessEnvelope::from_json(&json_presence)?;

    assert_eq!(decoded_presence.room_code, "VIVA-401");
    if let AwarenessMessage::PresenceUpdate { presence: p, .. } = decoded_presence.message {
        assert_eq!(p.user_id, user_id);
        assert_eq!(p.username, "alice_candidate");
        assert_eq!(p.role, "candidate");
        assert_eq!(p.cursor, Some(CursorPosition::new(15, 30)));
        assert_eq!(p.color, "#e4f222");
    } else {
        panic!("expected PresenceUpdate variant");
    }

    // 2. Cursor move envelope
    let env_cursor = AwarenessEnvelope::cursor_move("VIVA-401", user_id, 42, 10);
    let json_cursor = env_cursor.to_json()?;
    let decoded_cursor = AwarenessEnvelope::from_json(&json_cursor)?;

    if let AwarenessMessage::CursorMove { user_id: uid, cursor: c, .. } = decoded_cursor.message {
        assert_eq!(uid, user_id);
        assert_eq!(c.line, 42);
        assert_eq!(c.column, 10);
    } else {
        panic!("expected CursorMove variant");
    }

    // 3. Peer leave envelope
    let env_leave = AwarenessEnvelope::peer_leave("VIVA-401", user_id);
    let json_leave = env_leave.to_json()?;
    let decoded_leave = AwarenessEnvelope::from_json(&json_leave)?;

    if let AwarenessMessage::PeerLeave { user_id: uid, .. } = decoded_leave.message {
        assert_eq!(uid, user_id);
    } else {
        panic!("expected PeerLeave variant");
    }

    Ok(())
}

#[test]
fn test_room_manager_isolation() {
    let manager = VivaRoomManager::new();

    let room_alpha = manager.get_or_create_room("ROOM-ALPHA");
    let room_beta = manager.get_or_create_room("ROOM-BETA");

    // Edits in room Alpha
    room_alpha.doc().insert_text(0, "// Alpha code template\n");

    // Edits in room Beta
    room_beta.doc().insert_text(0, "// Beta code template\n");

    // Assert strict isolation between room documents
    assert_eq!(
        room_alpha.doc().export_code_snapshot(),
        "// Alpha code template\n"
    );
    assert_eq!(
        room_beta.doc().export_code_snapshot(),
        "// Beta code template\n"
    );

    // Verify room manager tracking
    assert_eq!(manager.room_count(), 2);

    // Re-requesting ROOM-ALPHA returns the same Arc instance
    let room_alpha_again = manager.get_or_create_room("ROOM-ALPHA");
    assert!(Arc::ptr_eq(&room_alpha, &room_alpha_again));
    assert_eq!(
        room_alpha_again.doc().export_code_snapshot(),
        "// Alpha code template\n"
    );

    // Verify room removal
    let removed = manager.remove_room("ROOM-ALPHA");
    assert!(removed.is_some());
    assert_eq!(manager.room_count(), 1);
    assert!(manager.get_room("ROOM-ALPHA").is_none());
}
