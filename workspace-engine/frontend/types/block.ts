export type BlockType =
  | "text"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list"
  | "numbered_list"
  | "to_do"
  | "toggle"
  | "code"
  | "quote"
  | "callout"
  | "divider"
  | "table"
  | "image"
  | "embed";

export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  link?: string;
}

export interface BlockProperties {
  checked?: boolean;
  language?: string;
  calloutIcon?: string;
  calloutColor?: string;
  textColor?: string;
  backgroundColor?: string;
  isOpen?: boolean; // For toggle blocks
  url?: string; // For images/embeds
  caption?: string;
  tableData?: string[][]; // For table blocks
}

export interface Block {
  id: string;
  page_id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: RichTextSpan[];
  properties: BlockProperties;
  sort_order: string;
  created_at?: string;
  updated_at?: string;
}

export interface BlockTreeNode extends Block {
  children: BlockTreeNode[];
}

export interface BlockCreateInput {
  page_id: string;
  parent_block_id?: string | null;
  type?: BlockType;
  content?: RichTextSpan[];
  properties?: BlockProperties;
  before_block_id?: string;
  after_block_id?: string;
}

export interface BlockUpdateInput {
  type?: BlockType;
  content?: RichTextSpan[];
  properties?: BlockProperties;
  parent_block_id?: string | null;
}

export interface BlockMoveInput {
  new_parent_block_id?: string | null;
  before_block_id?: string;
  after_block_id?: string;
}
