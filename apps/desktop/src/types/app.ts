export type FlatFile = {
  path: string;
  name: string;
  relativePath: string;
};

export type DesktopAppProps = {
  glyph: NonNullable<Window["glyph"]>;
};
