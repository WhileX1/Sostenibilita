import type {
  Position,
  Result,
  Token,
  TokenKind,
} from "./types";

// Keyword lookup uses uppercase as the canonical form so the source can mix
// cases (`IF`, `if`, `If` all tokenize to the same kind). Identifiers stay
// case-sensitive — this only catches the reserved words.
const KEYWORDS: Record<string, TokenKind> = {
  IF: "IF",
  ELSE: "ELSE",
  END: "END",
  AND: "AND",
  OR: "OR",
  TRUE: "TRUE",
  FALSE: "FALSE",
};

export function tokenize(src: string): Result<Token[]> {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const at = (): Position => ({ line, col });
  const advance = (): void => {
    if (src[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  };

  while (i < src.length) {
    const ch = src[i];

    // Inline whitespace — meaningless. Newlines fall through to the explicit
    // NEWLINE handler below because they separate statements.
    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    if (ch === "\n") {
      const pos = at();
      tokens.push({ kind: "NEWLINE", text: "\n", pos });
      advance();
      // Collapse runs of blank lines into a single NEWLINE so the parser
      // doesn't have to skip them itself between statements.
      while (
        i < src.length &&
        (src[i] === " " ||
          src[i] === "\t" ||
          src[i] === "\r" ||
          src[i] === "\n")
      ) {
        advance();
      }
      continue;
    }

    if (isDigit(ch) || (ch === "." && i + 1 < src.length && isDigit(src[i + 1]))) {
      const pos = at();
      const start = i;
      while (i < src.length && isDigit(src[i])) advance();
      if (src[i] === "." && i + 1 < src.length && isDigit(src[i + 1])) {
        advance();
        while (i < src.length && isDigit(src[i])) advance();
      }
      tokens.push({ kind: "NUMBER", text: src.slice(start, i), pos });
      continue;
    }

    if (ch === '"' || ch === "'") {
      const pos = at();
      const quote = ch;
      advance(); // open quote
      const start = i;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\n") {
          return {
            ok: false,
            error: { message: "string runs over end of line", pos },
          };
        }
        advance();
      }
      if (i >= src.length) {
        return {
          ok: false,
          error: { message: "unterminated string", pos },
        };
      }
      const text = src.slice(start, i);
      advance(); // close quote
      tokens.push({ kind: "STRING", text, pos });
      continue;
    }

    if (isIdentStart(ch)) {
      const pos = at();
      const start = i;
      while (i < src.length && isIdentCont(src[i])) advance();
      const text = src.slice(start, i);
      const kw = KEYWORDS[text.toUpperCase()];
      tokens.push({ kind: kw ?? "IDENT", text, pos });
      continue;
    }

    // `!=` is the only multi-char operator. `!` on its own isn't valid,
    // so we error out before falling through to the single-char table —
    // a stray `!` would otherwise produce the generic "unexpected character"
    // message, which doesn't hint at the intended `!=` form.
    if (ch === "!") {
      const pos = at();
      if (src[i + 1] === "=") {
        tokens.push({ kind: "NEQ", text: "!=", pos });
        advance();
        advance();
        continue;
      }
      return {
        ok: false,
        error: {
          message:
            "use '!=' for not-equal — '!' on its own isn't a valid operator",
          pos,
        },
      };
    }

    const pos = at();
    const single = SINGLE_CHAR_TOKENS[ch];
    if (single !== undefined) {
      tokens.push({ kind: single, text: ch, pos });
      advance();
      continue;
    }

    return {
      ok: false,
      error: { message: `unexpected character '${ch}'`, pos },
    };
  }

  tokens.push({ kind: "EOF", text: "", pos: at() });
  return { ok: true, value: tokens };
}

const SINGLE_CHAR_TOKENS: Record<string, TokenKind> = {
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  "%": "PERCENT",
  "=": "EQ",
  "<": "LT",
  ">": "GT",
  "(": "LPAREN",
  ")": "RPAREN",
  ",": "COMMA",
};

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_"
  );
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
