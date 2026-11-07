import { useEffect, useMemo, useRef, useState } from "react";
import { calculate, formatResult, type AngleMode } from "./mathEngine";

type View = "calculator" | "memory" | "formulas" | "history";
type Variable = { id: string; name: string; value: string };
type Formula = { id: string; title: string; expression: string };
type HistoryItem = {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
  mode: AngleMode;
};

const formulaSeeds: Formula[] = [
  { id: "seed-1", title: "Square of Sum", expression: "(a+b)² = a² + 2ab + b²" },
  { id: "seed-2", title: "Square of Difference", expression: "(a-b)² = a² - 2ab + b²" },
  { id: "seed-3", title: "Difference of Squares", expression: "a²-b² = (a+b)(a-b)" },
  { id: "seed-4", title: "Circle Area", expression: "A = πr²" },
  { id: "seed-5", title: "Circle Circumference", expression: "C = 2πr" },
];

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    calculator: (
      <>
        <rect x="4" y="2.5" width="16" height="19" rx="3" />
        <path d="M7.5 6.5h9M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" />
      </>
    ),
    memory: (
      <>
        <path d="M5 4v16M19 4v16M5 8h14M5 16h14" />
        <path d="M9 12h6" />
      </>
    ),
    formulas: (
      <>
        <path d="M4 3h16v18H4z" />
        <path d="M8 8h8M8 12h3M8 16h8" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    edit: (
      <>
        <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "calculator", label: "Calculator", icon: "calculator" },
  { id: "memory", label: "Memory", icon: "memory" },
  { id: "formulas", label: "Formula Library", icon: "formulas" },
  { id: "history", label: "History", icon: "history" },
];

const keys = [
  ["sin", "fn", "sin("],
  ["cos", "fn", "cos("],
  ["tan", "fn", "tan("],
  ["cosec", "fn", "cosec("],
  ["sec", "fn", "sec("],
  ["cot", "fn", "cot("],
  ["sin⁻¹", "fn", "sin⁻¹("],
  ["cos⁻¹", "fn", "cos⁻¹("],
  ["tan⁻¹", "fn", "tan⁻¹("],
  ["log", "fn", "log("],
  ["ln", "fn", "ln("],
  ["√", "fn", "√("],
  ["x²", "fn", "²"],
  ["x³", "fn", "³"],
  ["xʸ", "fn", "^"],
  ["1/x", "fn", "reciprocal"],
  ["n!", "fn", "!"],
  ["|x|", "fn", "abs("],
  ["AC", "danger", "clear"],
  ["(", "utility", "("],
  [")", "utility", ")"],
  ["%", "utility", "%"],
  ["DEL", "danger", "delete"],
  ["÷", "operator", "÷"],
  ["7", "number", "7"],
  ["8", "number", "8"],
  ["9", "number", "9"],
  ["π", "constant", "π"],
  ["e", "constant", "e"],
  ["×", "operator", "×"],
  ["4", "number", "4"],
  ["5", "number", "5"],
  ["6", "number", "6"],
  ["+", "operator", "+"],
  ["−", "operator", "−"],
  ["=", "equals", "equals"],
  ["1", "number", "1"],
  ["2", "number", "2"],
  ["3", "number", "3"],
  ["0", "number wide", "0"],
  [".", "number", "."],
] as const;

export default function App() {
  const [view, setView] = useState<View>("calculator");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mode, setMode] = useStoredState<AngleMode>("nova-mode", "DEG");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [error, setError] = useState("");
  const [variables, setVariables] = useStoredState<Variable[]>("nova-variables", []);
  const [formulas, setFormulas] = useStoredState<Formula[]>("nova-formulas", formulaSeeds);
  const [history, setHistory] = useStoredState<HistoryItem[]>("nova-history", []);
  const [search, setSearch] = useState("");
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showFormulaForm, setShowFormulaForm] = useState(false);
  const [copied, setCopied] = useState("");
  const expressionRef = useRef(expression);
  expressionRef.current = expression;

  const variableMap = useMemo(
    () => Object.fromEntries(variables.map((item) => [item.name, Number(item.value)])),
    [variables],
  );
  const preview = useMemo(() => {
    if (!expression) return "";
    try {
      return formatResult(calculate(expression, mode, variableMap));
    } catch {
      return "";
    }
  }, [expression, mode, variableMap]);

  const append = (value: string) => {
    setError("");
    setExpression((current) => {
      if (value === "reciprocal") return current ? `1/(${current})` : "1/(";
      return current + value;
    });
  };

  const evaluate = () => {
    try {
      const value = formatResult(calculate(expressionRef.current, mode, variableMap));
      setResult(value);
      setError("");
      setHistory((items) =>
        [
          {
            id: crypto.randomUUID(),
            expression: expressionRef.current,
            result: value,
            timestamp: new Date().toISOString(),
            mode,
          },
          ...items,
        ].slice(0, 250),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid expression");
    }
  };

  const handleKey = (action: string) => {
    if (action === "clear") {
      setExpression("");
      setResult("0");
      setError("");
      return;
    }
    if (action === "delete") {
      setExpression((current) => current.slice(0, -1));
      setError("");
      return;
    }
    if (action === "equals") {
      evaluate();
      return;
    }
    append(action);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (/^[0-9.+\-*/^()%]$/.test(event.key)) {
        event.preventDefault();
        append(event.key === "*" ? "×" : event.key === "/" ? "÷" : event.key);
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        evaluate();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        handleKey("delete");
      } else if (event.key === "Escape") handleKey("clear");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectView = (next: View) => {
    setView(next);
    setMobileMenu(false);
  };
  const useExpression = (value: string) => {
    const usable = value.includes("=") ? value.split("=").at(-1)!.trim() : value;
    setExpression(usable);
    setView("calculator");
    setError("");
  };
  const copyFormula = async (formula: Formula) => {
    await navigator.clipboard.writeText(formula.expression);
    setCopied(formula.id);
    window.setTimeout(() => setCopied(""), 1300);
  };

  const saveVariable = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const value = String(data.get("value")).trim();
    if (!/^[a-zA-Z_π][a-zA-Z0-9_π]*$/.test(name)) return;
    try {
      calculate(value, mode, variableMap);
    } catch {
      return;
    }
    const resolved = formatResult(calculate(value, mode, variableMap));
    setVariables((items) =>
      editingVariable
        ? items.map((item) =>
            item.id === editingVariable.id ? { ...item, name, value: resolved } : item,
          )
        : [
            ...items.filter((item) => item.name !== name),
            { id: crypto.randomUUID(), name, value: resolved },
          ],
    );
    setShowVariableForm(false);
    setEditingVariable(null);
  };

  const saveFormula = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title")).trim();
    const formulaExpression = String(data.get("expression")).trim();
    if (!title || !formulaExpression) return;
    setFormulas((items) =>
      editingFormula
        ? items.map((item) =>
            item.id === editingFormula.id
              ? { ...item, title, expression: formulaExpression }
              : item,
          )
        : [{ id: crypto.randomUUID(), title, expression: formulaExpression }, ...items],
    );
    setShowFormulaForm(false);
    setEditingFormula(null);
  };

  const filteredFormulas = formulas.filter((item) =>
    `${item.title} ${item.expression}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NovaCalc</strong>
            <span>SCIENTIFIC</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => selectView(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "history" && history.length > 0 && <em>{history.length}</em>}
            </button>
          ))}
        </nav>
        <div className="side-tip">
          <span>PRO TIP</span>
          <p>Use your keyboard for faster calculations.</p>
          <kbd>Enter</kbd>
          <small> to solve</small>
        </div>
        <div className="side-footer">
          <span className="status-dot" />
          All systems ready <b>v2.4</b>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="menu-scrim"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <main>
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
          <div>
            <p>WORKSPACE</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="header-actions">
            <div className="mode-toggle" aria-label="Angle mode">
              {(["DEG", "RAD"] as AngleMode[]).map((item) => (
                <button
                  key={item}
                  className={mode === item ? "active" : ""}
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="memory-pill">
              <span>M</span>
              {variables.length}
            </div>
          </div>
        </header>

        <div className="mobile-tabs">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => selectView(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label.replace("Formula Library", "Formulas")}</span>
            </button>
          ))}
        </div>

        {view === "calculator" && (
          <section className="calculator-view">
            <div className="calculator-column">
              <div className={`display ${error ? "has-error" : ""}`}>
                <div className="display-top">
                  <span className="display-mode">{mode}</span>
                  {variables.length > 0 && <span className="display-memory">M</span>}
                  <span>LIVE PREVIEW</span>
                </div>
                <div className="expression">{expression || <span>Enter an expression</span>}</div>
                {error ? (
                  <div className="error-message">{error}</div>
                ) : (
                  <div className="preview">{preview && expression ? `= ${preview}` : "\u00a0"}</div>
                )}
                <div className="result-row">
                  <span>RESULT</span>
                  <strong>{error ? "—" : preview || result}</strong>
                </div>
              </div>
              <div className="keypad" aria-label="Scientific calculator keypad">
                {keys.map(([label, type, action], index) => (
                  <button
                    key={`${label}-${index}`}
                    className={`key ${type}`}
                    onClick={() => handleKey(action)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="keyboard-hint">
                Keyboard ready <span>•</span> Press <kbd>Enter</kbd> to calculate <span>•</span>{" "}
                <kbd>Esc</kbd> to clear
              </p>
            </div>
            <aside className="context-panel">
              <div className="panel-heading">
                <div>
                  <p>QUICK ACCESS</p>
                  <h2>Saved Variables</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    setEditingVariable(null);
                    setShowVariableForm(true);
                  }}
                  aria-label="Add variable"
                >
                  <Icon name="plus" />
                </button>
              </div>
              {variables.length === 0 ? (
                <EmptyState
                  icon="memory"
                  title="No variables yet"
                  text="Store constants and values to reuse them in any calculation."
                  action="Add variable"
                  onAction={() => setShowVariableForm(true)}
                />
              ) : (
                <div className="variable-list">
                  {variables.slice(0, 7).map((variable) => (
                    <button key={variable.id} onClick={() => append(variable.name)}>
                      <span>{variable.name}</span>
                      <strong>{variable.value}</strong>
                      <Icon name="plus" size={15} />
                    </button>
                  ))}
                </div>
              )}
              <button className="text-button" onClick={() => setView("memory")}>
                Manage all variables <Icon name="arrow" size={16} />
              </button>
              <div className="recent-block">
                <div className="mini-heading">
                  <h3>Recent calculations</h3>
                  <button onClick={() => setView("history")}>View all</button>
                </div>
                {history.length === 0 ? (
                  <p className="muted-copy">Your completed calculations will appear here.</p>
                ) : (
                  history.slice(0, 3).map((item) => (
                    <button
                      className="recent-item"
                      key={item.id}
                      onClick={() => useExpression(item.expression)}
                    >
                      <span>{item.expression}</span>
                      <strong>= {item.result}</strong>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </section>
        )}

        {view === "memory" && (
          <PageLayout
            title="Variable Memory"
            subtitle="Create named values and use them directly in expressions."
            action="New variable"
            onAction={() => {
              setEditingVariable(null);
              setShowVariableForm(true);
            }}
          >
            {variables.length === 0 ? (
              <EmptyState
                icon="memory"
                title="Build your variable library"
                text="Save constants, measurements, or any value. Try r = 5, then calculate 2πr."
                action="Create variable"
                onAction={() => setShowVariableForm(true)}
              />
            ) : (
              <div className="card-grid">
                {variables.map((variable) => (
                  <article className="data-card" key={variable.id}>
                    <div className="variable-symbol">{variable.name.slice(0, 2)}</div>
                    <div>
                      <p>VARIABLE</p>
                      <h3>{variable.name}</h3>
                      <strong>{variable.value}</strong>
                    </div>
                    <div className="card-actions">
                      <button
                        onClick={() => useExpression(variable.name)}
                        title="Use in calculator"
                      >
                        <Icon name="arrow" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingVariable(variable);
                          setShowVariableForm(true);
                        }}
                        title="Edit"
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        onClick={() =>
                          setVariables((items) => items.filter((item) => item.id !== variable.id))
                        }
                        title="Delete"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </PageLayout>
        )}

        {view === "formulas" && (
          <PageLayout
            title="Formula Library"
            subtitle={`${formulas.length} saved formulas for quick access.`}
            action="New formula"
            onAction={() => {
              setEditingFormula(null);
              setShowFormulaForm(true);
            }}
          >
            <label className="search-box">
              <Icon name="search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search formulas by title or expression…"
              />
            </label>
            <div className="formula-grid">
              {filteredFormulas.map((formula) => (
                <article className="formula-card" key={formula.id}>
                  <div className="formula-accent" />
                  <p>FORMULA</p>
                  <h3>{formula.title}</h3>
                  <div className="formula-expression">{formula.expression}</div>
                  <div className="formula-actions">
                    <button onClick={() => useExpression(formula.expression)}>
                      <Icon name="arrow" size={17} /> Insert
                    </button>
                    <span />
                    <button onClick={() => copyFormula(formula)} title="Copy">
                      <Icon name="copy" />
                      {copied === formula.id && <i>Copied</i>}
                    </button>
                    <button
                      onClick={() => {
                        setEditingFormula(formula);
                        setShowFormulaForm(true);
                      }}
                      title="Edit"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      onClick={() =>
                        setFormulas((items) => items.filter((item) => item.id !== formula.id))
                      }
                      title="Delete"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {filteredFormulas.length === 0 && (
              <EmptyState
                icon="search"
                title="No matching formulas"
                text="Try another search phrase or add a new formula."
              />
            )}
          </PageLayout>
        )}

        {view === "history" && (
          <PageLayout
            title="Calculation History"
            subtitle="Revisit and reuse your previous work."
            action={history.length ? "Clear history" : undefined}
            danger
            onAction={() => setHistory([])}
          >
            {history.length === 0 ? (
              <EmptyState
                icon="history"
                title="No calculations yet"
                text="Solve an expression and it will be saved here automatically."
                action="Open calculator"
                onAction={() => setView("calculator")}
              />
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <article key={item.id}>
                    <button className="history-main" onClick={() => useExpression(item.expression)}>
                      <div>
                        <span>
                          {new Date(item.timestamp).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          ·{" "}
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <p>{item.expression}</p>
                      </div>
                      <strong>{item.result}</strong>
                      <em>{item.mode}</em>
                    </button>
                    <button
                      className="delete-history"
                      onClick={() =>
                        setHistory((items) => items.filter((entry) => entry.id !== item.id))
                      }
                      aria-label="Delete history item"
                    >
                      <Icon name="trash" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </PageLayout>
        )}
      </main>

      {showVariableForm && (
        <Modal
          title={editingVariable ? "Edit variable" : "Create variable"}
          onClose={() => {
            setShowVariableForm(false);
            setEditingVariable(null);
          }}
        >
          <form onSubmit={saveVariable}>
            <label>
              Variable name
              <input
                name="name"
                defaultValue={editingVariable?.name}
                placeholder="e.g. radius or r"
                required
                pattern="[a-zA-Z_π][a-zA-Z0-9_π]*"
              />
            </label>
            <label>
              Value or expression
              <input
                name="value"
                defaultValue={editingVariable?.value}
                placeholder="e.g. 5 or √(25)"
                required
              />
            </label>
            <p className="form-note">
              Names can contain letters, numbers and underscores. Values are safely calculated
              before saving.
            </p>
            <button className="primary-button" type="submit">
              {editingVariable ? "Save changes" : "Add variable"}
            </button>
          </form>
        </Modal>
      )}
      {showFormulaForm && (
        <Modal
          title={editingFormula ? "Edit formula" : "Create formula"}
          onClose={() => {
            setShowFormulaForm(false);
            setEditingFormula(null);
          }}
        >
          <form onSubmit={saveFormula}>
            <label>
              Formula title
              <input
                name="title"
                defaultValue={editingFormula?.title}
                placeholder="e.g. Circle area"
                required
              />
            </label>
            <label>
              Expression
              <textarea
                name="expression"
                defaultValue={editingFormula?.expression}
                placeholder="e.g. A = πr²"
                rows={3}
                required
              />
            </label>
            <p className="form-note">
              When inserted, the expression after the equals sign is sent to the calculator.
            </p>
            <button className="primary-button" type="submit">
              {editingFormula ? "Save changes" : "Save formula"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PageLayout({
  title,
  subtitle,
  action,
  danger,
  onAction,
  children,
}: {
  title: string;
  subtitle: string;
  action?: string;
  danger?: boolean;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="page-view">
      <div className="page-title">
        <div>
          <p>YOUR WORKSPACE</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        {action && (
          <button
            className={danger ? "secondary-button danger-text" : "primary-button"}
            onClick={onAction}
          >
            {!danger && <Icon name="plus" />}
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <div>
            <p>NOVACALC MEMORY</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
