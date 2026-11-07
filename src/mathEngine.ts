export type AngleMode = "DEG" | "RAD";

type Token = { type: "number" | "id" | "op" | "lparen" | "rparen"; value: string };

const functions = new Set([
  "sin",
  "cos",
  "tan",
  "cosec",
  "csc",
  "sec",
  "cot",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "log",
  "ln",
  "abs",
]);

function tokenize(source: string, variableNames: string[]): Token[] {
  const input = source
    .replace(/\s+/g, "")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/sin⁻¹/g, "asin")
    .replace(/cos⁻¹/g, "acos")
    .replace(/tan⁻¹/g, "atan")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");

  const raw: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\d|\./.test(char)) {
      const match = input.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (!match) throw new Error("Invalid number");
      raw.push({ type: "number", value: match[0] });
      i += match[0].length;
    } else if (char === "π") {
      raw.push({ type: "id", value: "π" });
      i++;
    } else if (/[a-zA-Z_]/.test(char)) {
      const match = input.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (!match) throw new Error("Invalid variable");
      const identifier = match[0];
      const lower = identifier.toLowerCase();
      if (
        functions.has(lower) ||
        variableNames.includes(identifier) ||
        lower === "pi" ||
        lower === "e"
      ) {
        raw.push({ type: "id", value: identifier });
      } else {
        const candidates = variableNames
          .filter((name) => name !== "π")
          .sort((a, b) => b.length - a.length);
        const parts: string[] = [];
        let remainder = identifier;
        while (remainder) {
          const candidate = candidates.find((name) => remainder.startsWith(name));
          if (!candidate) break;
          parts.push(candidate);
          remainder = remainder.slice(candidate.length);
        }
        if (parts.length > 1 && !remainder)
          parts.forEach((part) => raw.push({ type: "id", value: part }));
        else raw.push({ type: "id", value: identifier });
      }
      i += match[0].length;
    } else if ("+-*/^!%".includes(char)) {
      raw.push({ type: "op", value: char });
      i++;
    } else if (char === "(") {
      raw.push({ type: "lparen", value: char });
      i++;
    } else if (char === ")") {
      raw.push({ type: "rparen", value: char });
      i++;
    } else if (char === "|") {
      const open = raw.length === 0 || ["op", "lparen"].includes(raw.at(-1)!.type);
      raw.push({ type: open ? "id" : "rparen", value: open ? "abs" : ")" });
      if (open) raw.push({ type: "lparen", value: "(" });
      i++;
    } else {
      throw new Error(`Unsupported character “${char}”`);
    }
  }

  const tokens: Token[] = [];
  raw.forEach((token, index) => {
    const previous = tokens.at(-1);
    if (previous) {
      const leftValue =
        previous.type === "number" ||
        previous.type === "id" ||
        previous.type === "rparen" ||
        (previous.type === "op" && ["!", "%"].includes(previous.value));
      const rightValue = token.type === "number" || token.type === "id" || token.type === "lparen";
      const isFunctionCall =
        previous.type === "id" &&
        functions.has(previous.value.toLowerCase()) &&
        token.type === "lparen";
      if (leftValue && rightValue && !isFunctionCall) tokens.push({ type: "op", value: "*" });
    }
    tokens.push(token);
  });
  return tokens;
}

export function calculate(
  source: string,
  mode: AngleMode,
  variables: Record<string, number> = {},
): number {
  if (!source.trim()) throw new Error("Enter an expression");
  const tokens = tokenize(source, Object.keys(variables));
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek()?.type === "op" && ["+", "-"].includes(peek().value)) {
      const op = consume().value;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parsePower();
    while (peek()?.type === "op" && ["*", "/"].includes(peek().value)) {
      const op = consume().value;
      const right = parsePower();
      if (op === "/" && Math.abs(right) < 1e-15) throw new Error("Cannot divide by zero");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };

  const parsePower = (): number => {
    let value = parseUnary();
    if (peek()?.type === "op" && peek().value === "^") {
      consume();
      value = Math.pow(value, parsePower());
    }
    return value;
  };

  const parseUnary = (): number => {
    if (peek()?.type === "op" && ["+", "-"].includes(peek().value)) {
      const op = consume().value;
      const value = parseUnary();
      return op === "-" ? -value : value;
    }
    return parsePostfix();
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (peek()?.type === "op" && ["!", "%"].includes(peek().value)) {
      const op = consume().value;
      if (op === "%") value /= 100;
      else {
        if (!Number.isInteger(value) || value < 0 || value > 170)
          throw new Error("Factorial needs an integer from 0 to 170");
        let result = 1;
        for (let n = 2; n <= value; n++) result *= n;
        value = result;
      }
    }
    return value;
  };

  const parsePrimary = (): number => {
    const token = consume();
    if (!token) throw new Error("Incomplete expression");
    if (token.type === "number") return Number(token.value);
    if (token.type === "lparen") {
      const value = parseExpression();
      if (consume()?.type !== "rparen") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token.type === "id") {
      const name = token.value;
      const lower = name.toLowerCase();
      if (functions.has(lower) && peek()?.type === "lparen") {
        consume();
        const argument = parseExpression();
        if (consume()?.type !== "rparen")
          throw new Error(`Missing closing parenthesis after ${name}`);
        return applyFunction(lower, argument, mode);
      }
      if (Object.hasOwn(variables, name)) return variables[name];
      if (name === "π" || lower === "pi") return Math.PI;
      if (lower === "e") return Math.E;
      throw new Error(`Unknown variable “${name}”`);
    }
    throw new Error("Unexpected operator");
  };

  const result = parseExpression();
  if (position !== tokens.length) throw new Error("Check the expression syntax");
  if (!Number.isFinite(result) || Number.isNaN(result))
    throw new Error("Result is not a real finite number");
  return result;
}

function applyFunction(name: string, value: number, mode: AngleMode): number {
  const radians = mode === "DEG" ? (value * Math.PI) / 180 : value;
  const fromRadians = (result: number) => (mode === "DEG" ? (result * 180) / Math.PI : result);
  const nearZero = (value: number) => Math.abs(value) < 1e-14;
  switch (name) {
    case "sin":
      return Math.sin(radians);
    case "cos":
      return Math.cos(radians);
    case "tan": {
      const divisor = Math.cos(radians);
      if (nearZero(divisor)) throw new Error("tan is undefined at this angle");
      return Math.sin(radians) / divisor;
    }
    case "cosec":
    case "csc": {
      const divisor = Math.sin(radians);
      if (nearZero(divisor)) throw new Error("cosec is undefined at this angle");
      return 1 / divisor;
    }
    case "sec": {
      const divisor = Math.cos(radians);
      if (nearZero(divisor)) throw new Error("sec is undefined at this angle");
      return 1 / divisor;
    }
    case "cot": {
      const divisor = Math.sin(radians);
      if (nearZero(divisor)) throw new Error("cot is undefined at this angle");
      return Math.cos(radians) / divisor;
    }
    case "asin":
      if (Math.abs(value) > 1) throw new Error("sin⁻¹ input must be between −1 and 1");
      return fromRadians(Math.asin(value));
    case "acos":
      if (Math.abs(value) > 1) throw new Error("cos⁻¹ input must be between −1 and 1");
      return fromRadians(Math.acos(value));
    case "atan":
      return fromRadians(Math.atan(value));
    case "sqrt":
      if (value < 0) throw new Error("Square root needs a non-negative value");
      return Math.sqrt(value);
    case "log":
      if (value <= 0) throw new Error("log needs a positive value");
      return Math.log10(value);
    case "ln":
      if (value <= 0) throw new Error("ln needs a positive value");
      return Math.log(value);
    case "abs":
      return Math.abs(value);
    default:
      throw new Error(`Unknown function “${name}”`);
  }
}

export function formatResult(value: number): string {
  if (Math.abs(value) < 1e-14) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e12 || absolute < 1e-9) return value.toExponential(9).replace(/\.?0+e/, "e");
  return Number(value.toPrecision(12)).toString();
}
