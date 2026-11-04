// Static/ISR twin of the homepage route. The page itself is src/app/[lang]/page.tsx — reused as is, so
// content, metadata and structured data cannot drift. middleware.ts rewrites "/", "/de", "/pl", "/ru"
// onto this tree, whose layout has no cookies()/draftMode() and so can actually be cached (see layout.tsx).
import HomePage, { generateMetadata } from "@/app/[lang]/page";

export const revalidate = 1800;
export const dynamicParams = false;
export { generateMetadata };
export default HomePage;
