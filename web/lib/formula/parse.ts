import type {
  BinaryOp,
  Expr,
  Position,
  Program,
  Result,
  Statement,
  Token,
  TokenKind,
} from "./types";

// Recursive-descent parser. Throws ParseError internally so the deeply
// nested calls don't have to thread Result<T> by hand; the top-level
// `parse` catches it and converts to the public Result shape.

class ParseError extends Error {
  constructor(message: string, public pos: Position) {
    super(message);
  }
}

interface Ctx {
  tokens: Token[];
  i: number;
}

export function parse(tokens: Token[]): Result<Program> {
  const ctx: Ctx = { tokens, i: 0 };
  try {
    skipNewlines(ctx);
    const body: Statement[] = [];
    while (peek(ctx).kind !== "EOF") {
      body.push(parseStatement(ctx));
      skipNewlines(ctx);
    }
    return { ok: true, value: { body } };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: { message: e.message, pos: e.pos } };
    }
    throw e;
  }
}

function peek(ctx: Ctx, offset = 0): Token {
  return ctx.tokens[ctx.i + offset];
}

function consume(ctx: Ctx): Token {
  return ctx.tokens[ctx.i++];
}

function expect(ctx: Ctx, kind: TokenKind, msg?: string): Token {
  const t = peek(ctx);
  if (t.kind !== kind) {
    throw new ParseError(msg ?? `expected ${kind}, got ${t.kind}`, t.pos);
  }
  return consume(ctx);
}

function skipNewlines(ctx: Ctx): void {
  while (peek(ctx).kind === "NEWLINE") consume(ctx);
}

// Statements

function parseStatement(ctx: Ctx): Statement {
  const t = peek(ctx);
  if (t.kind === "IF") return parseIf(ctx);
  if (t.kind === "IDENT") return parseAssign(ctx);
  throw new ParseError(
    `expected an assignment or IF, got ${t.kind}`,
    t.pos,
  );
}

function parseAssign(ctx: Ctx): Statement {
  const id = expect(ctx, "IDENT");
  expect(ctx, "EQ", "expected '=' after variable name");
  const expr = parseExpr(ctx);
  expectStatementEnd(ctx, "assignment");
  return { kind: "Assign", name: id.text, expr, pos: id.pos };
}

// Common end-of-statement check used by assignment and IF condition.
// Centralised so the user gets a consistent error vocabulary across
// statement contexts.
function expectStatementEnd(ctx: Ctx, context: string): void {
  const t = peek(ctx);
  if (t.kind === "NEWLINE" || t.kind === "EOF") return;
  throw new ParseError(
    `unexpected '${t.text || t.kind}' after ${context}`,
    t.pos,
  );
}

function parseIf(ctx: Ctx): Statement {
  const ifTok = expect(ctx, "IF");
  const cond = parseExpr(ctx);
  // The IF condition is on its own line; the body sits on the following
  // lines and runs until ELSE or END.
  expectStatementEnd(ctx, "IF condition");
  skipNewlines(ctx);

  const thenBranch = parseBlock(ctx, ifTok.pos, ["ELSE", "END"]);
  let elseBranch: Statement[] = [];
  if (peek(ctx).kind === "ELSE") {
    consume(ctx);
    expectStatementEnd(ctx, "ELSE");
    skipNewlines(ctx);
    elseBranch = parseBlock(ctx, ifTok.pos, ["END"]);
  }
  expect(ctx, "END", "expected END to close IF");

  return {
    kind: "If",
    cond,
    thenBranch,
    elseBranch,
    pos: ifTok.pos,
  };
}

function parseBlock(
  ctx: Ctx,
  ifPos: Position,
  terminators: TokenKind[],
): Statement[] {
  const out: Statement[] = [];
  while (true) {
    const k = peek(ctx).kind;
    if (terminators.includes(k)) return out;
    if (k === "EOF") {
      throw new ParseError(
        "unterminated IF (missing END)",
        ifPos,
      );
    }
    out.push(parseStatement(ctx));
    skipNewlines(ctx);
  }
}

// Expressions, precedence climbing low → high:
//   OR  →  AND  →  comparison (= != < >)  →  + -  →  * /  →  unary -  →  postfix %  →  primary

function parseExpr(ctx: Ctx): Expr {
  return parseOr(ctx);
}

function parseOr(ctx: Ctx): Expr {
  let left = parseAnd(ctx);
  while (peek(ctx).kind === "OR") {
    const op = consume(ctx);
    const right = parseAnd(ctx);
    left = { kind: "Binary", op: "OR", left, right, pos: op.pos };
  }
  return left;
}

function parseAnd(ctx: Ctx): Expr {
  let left = parseComparison(ctx);
  while (peek(ctx).kind === "AND") {
    const op = consume(ctx);
    const right = parseComparison(ctx);
    left = { kind: "Binary", op: "AND", left, right, pos: op.pos };
  }
  return left;
}

function parseComparison(ctx: Ctx): Expr {
  const left = parseAdditive(ctx);
  const t = peek(ctx);
  if (t.kind === "EQ" || t.kind === "NEQ" || t.kind === "LT" || t.kind === "GT") {
    consume(ctx);
    const right = parseAdditive(ctx);
    const op: BinaryOp =
      t.kind === "EQ"
        ? "="
        : t.kind === "NEQ"
          ? "!="
          : t.kind === "LT"
            ? "<"
            : ">";
    return { kind: "Binary", op, left, right, pos: t.pos };
  }
  return left;
}

function parseAdditive(ctx: Ctx): Expr {
  let left = parseMultiplicative(ctx);
  while (peek(ctx).kind === "PLUS" || peek(ctx).kind === "MINUS") {
    const op = consume(ctx);
    const right = parseMultiplicative(ctx);
    left = {
      kind: "Binary",
      op: op.kind === "PLUS" ? "+" : "-",
      left,
      right,
      pos: op.pos,
    };
  }
  return left;
}

function parseMultiplicative(ctx: Ctx): Expr {
  let left = parseUnary(ctx);
  while (peek(ctx).kind === "STAR" || peek(ctx).kind === "SLASH") {
    const op = consume(ctx);
    const right = parseUnary(ctx);
    left = {
      kind: "Binary",
      op: op.kind === "STAR" ? "*" : "/",
      left,
      right,
      pos: op.pos,
    };
  }
  return left;
}

function parseUnary(ctx: Ctx): Expr {
  if (peek(ctx).kind === "MINUS") {
    const op = consume(ctx);
    const operand = parseUnary(ctx);
    return { kind: "Unary", op: "-", operand, pos: op.pos };
  }
  return parsePostfix(ctx);
}

function parsePostfix(ctx: Ctx): Expr {
  let e = parsePrimary(ctx);
  if (peek(ctx).kind === "PERCENT") {
    const op = consume(ctx);
    e = { kind: "Percent", value: e, pos: op.pos };
  }
  return e;
}

function parsePrimary(ctx: Ctx): Expr {
  const t = peek(ctx);
  switch (t.kind) {
    case "NUMBER":
      consume(ctx);
      return { kind: "NumLit", value: parseFloat(t.text), pos: t.pos };
    case "STRING":
      consume(ctx);
      return { kind: "StrLit", value: t.text, pos: t.pos };
    case "TRUE":
      consume(ctx);
      return { kind: "BoolLit", value: true, pos: t.pos };
    case "FALSE":
      consume(ctx);
      return { kind: "BoolLit", value: false, pos: t.pos };
    case "LPAREN": {
      consume(ctx);
      const e = parseExpr(ctx);
      expect(ctx, "RPAREN", "expected ')'");
      return e;
    }
    case "IDENT": {
      consume(ctx);
      if (peek(ctx).kind === "LPAREN") {
        consume(ctx);
        const args: Expr[] = [];
        if (peek(ctx).kind !== "RPAREN") {
          args.push(parseExpr(ctx));
          while (peek(ctx).kind === "COMMA") {
            consume(ctx);
            args.push(parseExpr(ctx));
          }
        }
        expect(ctx, "RPAREN", "expected ')' to close function call");
        return { kind: "Call", name: t.text, args, pos: t.pos };
      }
      return { kind: "Ident", name: t.text, pos: t.pos };
    }
    default:
      throw new ParseError(`unexpected ${t.kind}`, t.pos);
  }
}
