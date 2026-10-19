use judge_core::Language;
use tree_sitter::{Node, Parser, Tree};

use crate::errors::WorkerError;

/// Structural token representation after AST extraction and identifier normalization.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct StructuralToken {
    pub kind: String,
    pub start_byte: usize,
    pub end_byte: usize,
}

impl StructuralToken {
    #[must_use]
    pub fn new(kind: impl Into<String>, start_byte: usize, end_byte: usize) -> Self {
        Self {
            kind: kind.into(),
            start_byte,
            end_byte,
        }
    }
}

/// Extracts structural AST tokens from source code according to language grammar.
pub struct AstTokenizer;

impl AstTokenizer {
    /// Tokenizes source code into normalized structural tokens.
    ///
    /// Ignores comments and whitespace; normalizes variable names and literals.
    ///
    /// # Errors
    /// Returns [`WorkerError::ParseError`] if grammar loading or parsing fails.
    pub fn tokenize(
        language: Language,
        source_code: &str,
    ) -> Result<Vec<StructuralToken>, WorkerError> {
        let mut parser = Parser::new();
        let ts_lang = match language {
            Language::Cpp => tree_sitter_cpp::LANGUAGE.into(),
            Language::Python => tree_sitter_python::LANGUAGE.into(),
            Language::Java => tree_sitter_java::LANGUAGE.into(),
        };

        parser.set_language(&ts_lang).map_err(|e| {
            WorkerError::ParseError(format!("failed to load tree-sitter language: {e}"))
        })?;

        let tree: Tree = parser
            .parse(source_code, None)
            .ok_or_else(|| WorkerError::ParseError("tree-sitter parsing failed".to_string()))?;

        let mut tokens = Vec::new();
        walk_ast(tree.root_node(), &mut tokens);
        Ok(tokens)
    }
}

fn walk_ast(node: Node, tokens: &mut Vec<StructuralToken>) {
    let kind = node.kind();

    // 1. Skip comments entirely
    if is_comment(kind) {
        return;
    }

    // 2. Normalize identifiers and literals
    if is_identifier(kind) {
        tokens.push(StructuralToken::new(
            "ID",
            node.start_byte(),
            node.end_byte(),
        ));
        return;
    }

    if is_literal(kind) {
        tokens.push(StructuralToken::new(
            "LIT",
            node.start_byte(),
            node.end_byte(),
        ));
        return;
    }

    // 3. For leaf or keyword nodes, emit the kind directly
    if node.child_count() == 0 {
        // Only emit non-empty, non-whitespace tokens
        let trimmed = kind.trim();
        if !trimmed.is_empty() {
            tokens.push(StructuralToken::new(
                trimmed,
                node.start_byte(),
                node.end_byte(),
            ));
        }
        return;
    }

    // 4. For internal nodes, emit opening tag, recurse children, emit closing tag
    tokens.push(StructuralToken::new(
        format!("OPEN_{kind}"),
        node.start_byte(),
        node.end_byte(),
    ));

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        walk_ast(child, tokens);
    }

    tokens.push(StructuralToken::new(
        format!("CLOSE_{kind}"),
        node.start_byte(),
        node.end_byte(),
    ));
}

fn is_comment(kind: &str) -> bool {
    kind.contains("comment") || kind == "line_comment" || kind == "block_comment"
}

fn is_identifier(kind: &str) -> bool {
    matches!(
        kind,
        "identifier"
            | "field_identifier"
            | "type_identifier"
            | "property_identifier"
            | "variable_name"
            | "function_name"
            | "namespace_identifier"
    )
}

fn is_literal(kind: &str) -> bool {
    kind.contains("literal")
        || matches!(
            kind,
            "integer"
                | "float"
                | "number"
                | "string"
                | "character"
                | "true"
                | "false"
                | "null"
                | "nullptr"
                | "none"
                | "boolean"
        )
}
