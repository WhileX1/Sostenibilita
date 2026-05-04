// Public types for the formula DSL — kept in one file so tokenizer, parser,
// evaluator, and the editor UI can all import from a single place without
// circular dependencies.

// Both 1-indexed so error messages match what an editor's status bar shows
// (column 1 is the first character of the line).
export interface Position {
  line: number;
  col: number;
}

export type Value = number | boolean | string;

export type TokenKind =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  // Keywords. Tokenized separately from IDENT so the parser doesn't have to
  // re-check identifier text. Case-insensitive on input (`IF` = `if` = `If`).
  | "IF"
  | "ELSE"
  | "END"
  | "AND"
  | "OR"
  | "TRUE"
  | "FALSE"
  // Operators / punctuation
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "PERCENT"
  | "EQ"
  | "NEQ"
  | "LT"
  | "GT"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  // Statement separator. Consecutive blank lines collapse into a single
  // NEWLINE so the parser doesn't have to worry about how much vertical
  // whitespace the user left between statements.
  | "NEWLINE"
  | "EOF";

export interface Token {
  kind: TokenKind;
  // Raw lexeme. For NUMBER it's the digits, for STRING it's the inner text
  // (no quotes), for IDENT it's the variable name as written.
  text: string;
  pos: Position;
}

// AST. The script is a sequence of statements; each statement is either an
// assignment or an IF block (with an optional ELSE branch).
export type Statement =
  | {
      kind: "Assign";
      name: string;
      expr: Expr;
      pos: Position;
    }
  | {
      kind: "If";
      cond: Expr;
      thenBranch: Statement[];
      elseBranch: Statement[];
      pos: Position;
    };

export type BinaryOp = "+" | "-" | "*" | "/" | "=" | "!=" | "<" | ">" | "AND" | "OR";

export type Expr =
  | { kind: "NumLit"; value: number; pos: Position }
  | { kind: "StrLit"; value: string; pos: Position }
  | { kind: "BoolLit"; value: boolean; pos: Position }
  | { kind: "Ident"; name: string; pos: Position }
  | { kind: "Call"; name: string; args: Expr[]; pos: Position }
  | { kind: "Unary"; op: "-"; operand: Expr; pos: Position }
  | { kind: "Binary"; op: BinaryOp; left: Expr; right: Expr; pos: Position }
  // Postfix `n%`. Standalone it evaluates to `n / 100`. As the right operand
  // of `+` / `-` the evaluator triggers the calculator rule
  // (`x + 10%` ≡ `x * 1.10`, `x - 10%` ≡ `x * 0.90`).
  | { kind: "Percent"; value: Expr; pos: Position };

export interface Program {
  body: Statement[];
}

export interface FormulaError {
  message: string;
  pos: Position;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: FormulaError };
