import { getHomePageByLang } from "@/sanity/sanity.utils";
import Nav from "./sections/Nav";
import Hero from "./sections/Hero";
import Brochure from "./sections/Brochure";
import About from "./sections/About";
import FeaturedProjects from "./sections/FeaturedProjects";

/* Homepage redesign preview — built section by section.
   Pulls the REAL homepage content (local content DB) and restyles it.
   Step 1: the hero. Remaining sections follow after review. */

export const dynamic = "force-dynamic";

export default async function PreviewHome() {
  const homePage = await getHomePageByLang("en");

  return (
    <>
      <Nav />
      <main>
        <Hero heroBlock={homePage.heroBlock} />
        <Brochure brochure={homePage.brochureBlock} />
        <About aboutBlock={homePage.aboutBlock} />
        <FeaturedProjects block={homePage.featuredProjectsBlock} lang="en" />

        <span className="preview-badge">Preview · Hero → Featured Projects</span>
      </main>
    </>
  );
}
