// Import tekstu pliku w testach (`./fixtures/x.html?raw`, Vite): nagrane dokumenty HTML jako napis.
declare module '*?raw' {
  const content: string;
  export default content;
}
