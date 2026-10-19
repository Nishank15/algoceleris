//! Yrs CRDT document synchronization for collaborative code editing.

use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{Doc, GetString, ReadTxn, StateVector, Text, Transact, Update};

use crate::errors::VivaError;

/// Shared Monaco code editor document synchronized via Yrs CRDTs.
#[derive(Debug)]
pub struct VivaDoc {
    doc: Doc,
}

impl VivaDoc {
    /// Name of the primary shared text structure in Yrs doc.
    pub const SHARED_TEXT_NAME: &'static str = "monaco";

    /// Creates a new empty `VivaDoc`.
    #[must_use]
    pub fn new() -> Self {
        let doc = Doc::new();
        Self { doc }
    }

    /// Creates a `VivaDoc` initialized with starter code.
    #[must_use]
    pub fn with_initial_code(initial_code: &str) -> Self {
        let doc = Doc::new();
        let text = doc.get_or_insert_text(Self::SHARED_TEXT_NAME);
        let mut txn = doc.transact_mut();
        text.push(&mut txn, initial_code);
        drop(txn);
        Self { doc }
    }

    /// Applies a binary Yrs v1 client update to the document and returns the applied update bytes.
    ///
    /// # Errors
    /// Returns [`VivaError::CrdtSyncError`] if the update cannot be decoded or applied.
    pub fn apply_client_update(&self, update_bytes: &[u8]) -> Result<Vec<u8>, VivaError> {
        let update = Update::decode_v1(update_bytes)
            .map_err(|e| VivaError::CrdtSyncError(format!("failed to decode v1 update: {e}")))?;
        let mut txn = self.doc.transact_mut();
        txn.apply_update(update)
            .map_err(|e| VivaError::CrdtSyncError(format!("failed to apply update: {e}")))?;
        Ok(update_bytes.to_vec())
    }

    /// Generates a binary diff containing all updates missing from the client's state vector.
    ///
    /// # Errors
    /// Returns [`VivaError::CrdtSyncError`] if the state vector cannot be decoded.
    pub fn generate_diff_for_client(
        &self,
        state_vector_bytes: &[u8],
    ) -> Result<Vec<u8>, VivaError> {
        let sv = if state_vector_bytes.is_empty() {
            StateVector::default()
        } else {
            StateVector::decode_v1(state_vector_bytes).map_err(|e| {
                VivaError::CrdtSyncError(format!("failed to decode state vector: {e}"))
            })?
        };
        let txn = self.doc.transact();
        Ok(txn.encode_diff_v1(&sv))
    }

    /// Exports the current source code string from the `"monaco"` branch.
    #[must_use]
    pub fn export_code_snapshot(&self) -> String {
        let text = self.doc.get_or_insert_text(Self::SHARED_TEXT_NAME);
        let txn = self.doc.transact();
        text.get_string(&txn)
    }

    /// Inserts text at the given character index.
    pub fn insert_text(&self, index: u32, chunk: &str) {
        let text = self.doc.get_or_insert_text(Self::SHARED_TEXT_NAME);
        let mut txn = self.doc.transact_mut();
        text.insert(&mut txn, index, chunk);
    }

    /// Returns the current document state vector encoded as v1 bytes.
    #[must_use]
    pub fn state_vector_v1(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }

    /// Encodes the entire document state as a v1 update.
    #[must_use]
    pub fn encode_update_v1(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_diff_v1(&StateVector::default())
    }
}

impl Default for VivaDoc {
    fn default() -> Self {
        Self::new()
    }
}
