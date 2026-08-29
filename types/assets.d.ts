// Ambient module declarations so TypeScript accepts require()'d binary
// assets (Metro resolves these to a numeric asset id at runtime).
declare module '*.wav' {
  const value: number;
  export default value;
}

declare module '*.mp3' {
  const value: number;
  export default value;
}
