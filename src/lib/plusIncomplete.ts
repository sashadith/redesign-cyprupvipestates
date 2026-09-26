/* Constants shared by the Plus Properties sync (src/lib/plusPropertiesSync.ts)
   and the Action Center rule that reads its plus-incomplete: log rows
   (src/lib/actionCenter/rules/developers.ts). Constants only, no imports: the
   Action Center must not pull the sync's Drive, xml2js and HTML-parser
   dependencies into the admin's server graph for one string. */

/* Logged as plus-incomplete:<key> ok=false when a project that already has
   feed units has no price list in the folder this run and is skipped whole. */
export const MISSING_PRICE_LIST = "price list missing from the folder this run — nothing changed";
