import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

// ==============================
// Context của Accordion
// ==============================

interface AccordionContextType {
  openItem: string | null;
  setOpenItem: (value: string | null) => void;
}

const AccordionContext = createContext<
  AccordionContextType | undefined
>(undefined);

// ==============================
// Context của từng Item
// ==============================

interface AccordionItemContextType {
  value: string;
}

const AccordionItemContext = createContext<
  AccordionItemContextType | undefined
>(undefined);

// ==============================
// Accordion
// ==============================

interface AccordionProps {
  children: ReactNode;
}

function Accordion({ children }: AccordionProps) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <AccordionContext.Provider
      value={{
        openItem,
        setOpenItem,
      }}
    >
      <div>{children}</div>
    </AccordionContext.Provider>
  );
}

// ==============================
// Hook lấy Context Accordion
// ==============================

function useAccordion() {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error(
      "Accordion components must be used inside Accordion"
    );
  }

  return context;
}

// ==============================
// Accordion.Item
// ==============================

interface ItemProps {
  value: string;
  children: ReactNode;
}

function Item({ value, children }: ItemProps) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div className="accordion-item">
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

// ==============================
// Hook lấy value của Item
// ==============================

function useAccordionItem() {
  const context = useContext(AccordionItemContext);

  if (!context) {
    throw new Error(
      "Accordion.Header and Accordion.Panel must be inside Accordion.Item"
    );
  }

  return context;
}

// ==============================
// Accordion.Header
// ==============================

interface HeaderProps {
  children: ReactNode;
}

function Header({ children }: HeaderProps) {
  const { openItem, setOpenItem } = useAccordion();
  const { value } = useAccordionItem();

  const isOpen = openItem === value;

  const handleClick = () => {
    if (isOpen) {
      setOpenItem(null);
    } else {
      setOpenItem(value);
    }
  };

  return (
    <button
      className="accordion-header"
      onClick={handleClick}
    >
      <span>{children}</span>

      <span>
        {isOpen ? "−" : "+"}
      </span>
    </button>
  );
}

// ==============================
// Accordion.Panel
// ==============================

interface PanelProps {
  children: ReactNode;
}

function Panel({ children }: PanelProps) {
  const { openItem } = useAccordion();
  const { value } = useAccordionItem();

  const isOpen = openItem === value;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="accordion-panel">
      {children}
    </div>
  );
}

// ==============================
// Compound Components
// ==============================

Accordion.Item = Item;
Accordion.Header = Header;
Accordion.Panel = Panel;

export default Accordion;