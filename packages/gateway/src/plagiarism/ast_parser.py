from __future__ import annotations

import ast
import re
from typing import Dict, List, Optional, Set

PYTHON_BUILTINS: Set[str] = {
    "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes",
    "callable", "chr", "classmethod", "compile", "complex", "delattr",
    "dict", "dir", "divmod", "enumerate", "eval", "exec", "filter",
    "float", "format", "frozenset", "getattr", "globals", "hasattr",
    "hash", "help", "hex", "id", "input", "int", "isinstance",
    "issubclass", "iter", "len", "list", "locals", "map", "max",
    "memoryview", "min", "next", "object", "oct", "open", "ord",
    "pow", "print", "property", "range", "repr", "reversed", "round",
    "set", "setattr", "slice", "sorted", "staticmethod", "str",
    "sum", "super", "tuple", "type", "vars", "zip", "True", "False", "None",
}

CPP_JAVA_KEYWORDS: Set[str] = {
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor",
    "bool", "boolean", "break", "byte", "case", "catch", "char", "char8_t",
    "char16_t", "char32_t", "class", "compl", "concept", "const", "consteval",
    "constexpr", "constinit", "const_cast", "continue", "decltype", "default",
    "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit",
    "export", "extends", "extern", "false", "final", "finally", "float", "for",
    "friend", "goto", "if", "implements", "import", "inline", "instanceof",
    "int", "interface", "long", "mutable", "namespace", "native", "new",
    "noexcept", "not", "not_eq", "nullptr", "null", "operator", "or", "or_eq",
    "package", "private", "protected", "public", "register", "reinterpret_cast",
    "requires", "return", "short", "signed", "sizeof", "static", "static_assert",
    "static_cast", "strictfp", "struct", "super", "switch", "synchronized",
    "template", "this", "thread_local", "throw", "throws", "transient", "true",
    "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
    "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
    # Standard library common tokens
    "std", "cin", "cout", "endl",
    "System", "out", "println", "print", "Scanner", "ArrayList", "HashMap",
    "HashSet", "LinkedList", "List", "Map", "Set", "Math", "Arrays", "Collections",
}


class PythonASTNormalizer(ast.NodeVisitor):
    """
    Traverses Python AST, strips docstrings/comments/formatting,
    and replaces user-defined variables/functions with canonical indexed tokens ($V0, $V1...).
    """

    def __init__(self) -> None:
        self.tokens: List[str] = []
        self.ident_map: Dict[str, str] = {}
        self.var_counter: int = 0

    def _get_canonical_ident(self, name: str) -> str:
        if name in PYTHON_BUILTINS or name.startswith("__") and name.endswith("__"):
            return name
        if name not in self.ident_map:
            self.ident_map[name] = f"$V{self.var_counter}"
            self.var_counter += 1
        return self.ident_map[name]

    def visit_Module(self, node: ast.Module) -> None:
        self.tokens.append("MODULE")
        # Filter docstring
        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
            body = body[1:]
        for stmt in body:
            self.visit(stmt)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        canonical_fn = self._get_canonical_ident(node.name)
        self.tokens.extend(["DEF", canonical_fn, "("])
        for arg in node.args.args:
            canonical_arg = self._get_canonical_ident(arg.arg)
            self.tokens.append(canonical_arg)
        self.tokens.append(")")
        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
            body = body[1:]
        for stmt in body:
            self.visit(stmt)
        self.tokens.append("ENDDEF")

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        canonical_fn = self._get_canonical_ident(node.name)
        self.tokens.extend(["ASYNCDEF", canonical_fn, "("])
        for arg in node.args.args:
            canonical_arg = self._get_canonical_ident(arg.arg)
            self.tokens.append(canonical_arg)
        self.tokens.append(")")
        for stmt in node.body:
            self.visit(stmt)
        self.tokens.append("ENDASYNCDEF")

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        canonical_cls = self._get_canonical_ident(node.name)
        self.tokens.extend(["CLASS", canonical_cls])
        for stmt in node.body:
            self.visit(stmt)
        self.tokens.append("ENDCLASS")

    def visit_Return(self, node: ast.Return) -> None:
        self.tokens.append("RETURN")
        if node.value:
            self.visit(node.value)

    def visit_Assign(self, node: ast.Assign) -> None:
        self.tokens.append("ASSIGN")
        for target in node.targets:
            self.visit(target)
        self.visit(node.value)

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        self.tokens.extend(["AUGASSIGN", node.op.__class__.__name__])
        self.visit(node.target)
        self.visit(node.value)

    def visit_For(self, node: ast.For) -> None:
        self.tokens.append("FOR")
        self.visit(node.target)
        self.tokens.append("IN")
        self.visit(node.iter)
        for stmt in node.body:
            self.visit(stmt)
        if node.orelse:
            self.tokens.append("ELSE")
            for stmt in node.orelse:
                self.visit(stmt)
        self.tokens.append("ENDFOR")

    def visit_While(self, node: ast.While) -> None:
        self.tokens.append("WHILE")
        self.visit(node.test)
        for stmt in node.body:
            self.visit(stmt)
        if node.orelse:
            self.tokens.append("ELSE")
            for stmt in node.orelse:
                self.visit(stmt)
        self.tokens.append("ENDWHILE")

    def visit_If(self, node: ast.If) -> None:
        self.tokens.append("IF")
        self.visit(node.test)
        for stmt in node.body:
            self.visit(stmt)
        if node.orelse:
            self.tokens.append("ELSE")
            for stmt in node.orelse:
                self.visit(stmt)
        self.tokens.append("ENDIF")

    def visit_Name(self, node: ast.Name) -> None:
        self.tokens.append(self._get_canonical_ident(node.id))

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, (int, float)):
            self.tokens.append("$NUM")
        elif isinstance(node.value, str):
            self.tokens.append("$STR")
        elif isinstance(node.value, bool):
            self.tokens.append(str(node.value))
        elif node.value is None:
            self.tokens.append("None")
        else:
            self.tokens.append("$CONST")

    def visit_BinOp(self, node: ast.BinOp) -> None:
        self.tokens.append(f"OP_{node.op.__class__.__name__}")
        self.visit(node.left)
        self.visit(node.right)

    def visit_UnaryOp(self, node: ast.UnaryOp) -> None:
        self.tokens.append(f"UNOP_{node.op.__class__.__name__}")
        self.visit(node.operand)

    def visit_Compare(self, node: ast.Compare) -> None:
        self.tokens.append("COMPARE")
        self.visit(node.left)
        for op, comparator in zip(node.ops, node.comparators):
            self.tokens.append(f"OP_{op.__class__.__name__}")
            self.visit(comparator)

    def visit_Call(self, node: ast.Call) -> None:
        self.tokens.append("CALL")
        self.visit(node.func)
        self.tokens.append("(")
        for arg in node.args:
            self.visit(arg)
        for kw in node.keywords:
            self.tokens.append(f"kw_{kw.arg}")
            self.visit(kw.value)
        self.tokens.append(")")

    def visit_Subscript(self, node: ast.Subscript) -> None:
        self.tokens.append("SUBSCRIPT")
        self.visit(node.value)
        self.tokens.append("[")
        self.visit(node.slice)
        self.tokens.append("]")

    def visit_List(self, node: ast.List) -> None:
        self.tokens.append("[")
        for elt in node.elts:
            self.visit(elt)
        self.tokens.append("]")

    def visit_Dict(self, node: ast.Dict) -> None:
        self.tokens.append("{")
        for k, v in zip(node.keys, node.values):
            if k is not None:
                self.visit(k)
            self.visit(v)
        self.tokens.append("}")

    def visit_Set(self, node: ast.Set) -> None:
        self.tokens.append("SET(")
        for elt in node.elts:
            self.visit(elt)
        self.tokens.append(")")

    def generic_visit(self, node: ast.AST) -> None:
        self.tokens.append(node.__class__.__name__)
        super().generic_visit(node)


class LexicalNormalizer:
    """
    Tokenizes and normalizes languages without full AST runtime (e.g. C++, Java, fallback Python).
    Strips single and multi-line comments, maps user identifiers to $V0, $V1...,
    normalizes numbers and string literals, and maintains keywords and operators.
    """

    TOKEN_SPEC = [
        ("COMMENT_BLOCK", r"/\*[\s\S]*?\*/"),
        ("COMMENT_LINE", r"//.*"),
        ("STRING", r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''),
        ("NUMBER", r"\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b"),
        ("IDENT", r"\b[A-Za-z_][A-Za-z0-9_]*\b"),
        ("OP", r"==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|\+=|-=|\*=|/=|->|::|[+\-*/%<>=!&|^~]"),
        ("PUNCT", r"[{}\[\]();,.:?]"),
        ("SKIP", r"\s+"),
        ("MISC", r"."),
    ]

    MASTER_REGEX = re.compile("|".join(f"(?P<{pair[0]}>{pair[1]})" for pair in TOKEN_SPEC))

    def __init__(self, keywords: Set[str]) -> None:
        self.keywords = keywords

    def normalize(self, source_code: str) -> List[str]:
        tokens: List[str] = []
        ident_map: Dict[str, str] = {}
        var_counter = 0

        for match in self.MASTER_REGEX.finditer(source_code):
            kind = match.lastgroup
            val = match.group()

            if kind in ("COMMENT_BLOCK", "COMMENT_LINE", "SKIP"):
                continue
            elif kind == "STRING":
                tokens.append("$STR")
            elif kind == "NUMBER":
                tokens.append("$NUM")
            elif kind == "IDENT":
                if val in self.keywords:
                    tokens.append(val)
                else:
                    if val not in ident_map:
                        ident_map[val] = f"$V{var_counter}"
                        var_counter += 1
                    tokens.append(ident_map[val])
            elif kind in ("OP", "PUNCT"):
                tokens.append(val)
            # Ignore unmatched misc characters

        return tokens


class ASTNormalizer:
    """
    Unified normalizer supporting Python (via Python AST with lexical fallback)
    and C++ / Java (via robust lexical normalizer).
    """

    @classmethod
    def normalize(cls, source_code: str, language: str = "python") -> List[str]:
        cleaned_lang = language.strip().lower()
        if cleaned_lang in ("python", "python3", "py"):
            try:
                tree = ast.parse(source_code)
                visitor = PythonASTNormalizer()
                visitor.visit(tree)
                return visitor.tokens
            except Exception:
                # Fallback to lexical if incomplete or invalid python
                normalizer = LexicalNormalizer(PYTHON_BUILTINS)
                return normalizer.normalize(source_code)

        elif cleaned_lang in ("cpp", "c++", "c"):
            normalizer = LexicalNormalizer(CPP_JAVA_KEYWORDS)
            return normalizer.normalize(source_code)

        elif cleaned_lang == "java":
            normalizer = LexicalNormalizer(CPP_JAVA_KEYWORDS)
            return normalizer.normalize(source_code)

        else:
            # Generic fallback
            normalizer = LexicalNormalizer(CPP_JAVA_KEYWORDS)
            return normalizer.normalize(source_code)

    @classmethod
    def normalize_to_string(cls, source_code: str, language: str = "python") -> str:
        tokens = cls.normalize(source_code, language)
        return " ".join(tokens)
