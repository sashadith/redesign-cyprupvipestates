// Injects the viewer's design variables as `:root{--ds-...}` into <head> (CRM and partner portal).
// `vars` must come from cssVars() in ./theme: validated #RRGGBB values, whitelisted font names and
// numbers, so no user text reaches CSS. dangerouslySetInnerHTML is needed because React escapes the
// quotes around font names in text children ('Fraunces' would become &#x27;Fraunces&#x27;, which CSS
// does not decode inside <style>). As a second line of defence, characters that could close the rule
// or the <style> element are dropped.
export function DsStyle({ scope, vars }: { scope: "crm" | "portal"; vars: string }) {
  const safe = vars.replace(/[<>{}]/g, "");
  return <style data-ds={scope} dangerouslySetInnerHTML={{ __html: `:root{${safe}}` }} />;
}
