import { BlockType } from "@/types/block";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  ChevronRightSquare,
  Code,
  Quote,
  AlertCircle,
  Minus,
  Table,
  Image,
  Globe,
} from "lucide-react";

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "text",
    label: "Text",
    description: "Just start writing with plain text.",
    icon: Type,
    keywords: ["p", "paragraph", "text", "plain"],
  },
  {
    type: "heading_1",
    label: "Heading 1",
    description: "Big section heading.",
    icon: Heading1,
    keywords: ["h1", "heading1", "title", "#"],
  },
  {
    type: "heading_2",
    label: "Heading 2",
    description: "Medium section heading.",
    icon: Heading2,
    keywords: ["h2", "heading2", "subtitle", "##"],
  },
  {
    type: "heading_3",
    label: "Heading 3",
    description: "Small section heading.",
    icon: Heading3,
    keywords: ["h3", "heading3", "subheading", "###"],
  },
  {
    type: "to_do",
    label: "To-do list",
    description: "Track tasks with a to-do list.",
    icon: CheckSquare,
    keywords: ["todo", "task", "checkbox", "check", "[]"],
  },
  {
    type: "bulleted_list",
    label: "Bulleted list",
    description: "Create a simple bulleted list.",
    icon: List,
    keywords: ["bullet", "list", "ul", "-"],
  },
  {
    type: "numbered_list",
    label: "Numbered list",
    description: "Create a list with numbering.",
    icon: ListOrdered,
    keywords: ["number", "ordered", "ol", "1."],
  },
  {
    type: "toggle",
    label: "Toggle list",
    description: "Toggles can hide and show content inside.",
    icon: ChevronRightSquare,
    keywords: ["toggle", "collapse", "dropdown", "disclosure"],
  },
  {
    type: "code",
    label: "Code",
    description: "Capture a code snippet with syntax highlighting.",
    icon: Code,
    keywords: ["code", "snippet", "script", "```"],
  },
  {
    type: "quote",
    label: "Quote",
    description: "Capture a quote or important statement.",
    icon: Quote,
    keywords: ["quote", "blockquote", ">"],
  },
  {
    type: "callout",
    label: "Callout",
    description: "Make writing stand out with an icon.",
    icon: AlertCircle,
    keywords: ["callout", "box", "alert", "note", "tip"],
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visually divide blocks.",
    icon: Minus,
    keywords: ["divider", "hr", "line", "separator", "---"],
  },
  {
    type: "table",
    label: "Table",
    description: "Add a simple tabular data grid.",
    icon: Table,
    keywords: ["table", "grid", "data", "columns"],
  },
  {
    type: "image",
    label: "Image",
    description: "Upload or embed with a link.",
    icon: Image,
    keywords: ["image", "picture", "photo", "upload", "img"],
  },
  {
    type: "embed",
    label: "Embed",
    description: "Embed YouTube, Vimeo, Figma, or web content.",
    icon: Globe,
    keywords: ["embed", "youtube", "video", "figma", "vimeo", "iframe"],
  },
];
