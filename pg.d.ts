declare module 'pg' {
  // Adds placeholder fallback matching 'any' type to silence errors
  const content: any;
  export = content;
  const Pool: any;
  export = Pool;
}

