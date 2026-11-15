export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:email") {
    return {
      shortCircuit: true,
      url: new URL("./cloudflare-email-stub.js", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
