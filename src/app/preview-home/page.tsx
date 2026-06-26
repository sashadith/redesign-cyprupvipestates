import { getHomePageByLang } from "@/sanity/sanity.utils";
import Nav from "./sections/Nav";
import Hero from "./sections/Hero";
import Brochure from "./sections/Brochure";
import About from "./sections/About";
import FeaturedProjects from "./sections/FeaturedProjects";
import Cities from "./sections/Cities";
import Description from "./sections/Description";
import NewListings from "./sections/NewListings";
import Benefits from "./sections/Benefits";
import HowWeWork from "./sections/HowWeWork";
import CaseStudies from "./sections/CaseStudies";
import Content from "./sections/Content";
import Faq from "./sections/Faq";
import ParallaxBand from "./sections/ParallaxBand";
import Form from "./sections/Form";

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
        {homePage.citiesBlock && <Cities block={homePage.citiesBlock} />}
        {homePage.descriptionBlock && <Description block={homePage.descriptionBlock} />}
        <NewListings lang="en" />
        {homePage.benefitsBlock && <Benefits block={homePage.benefitsBlock} />}
        {homePage.howWeWorkBlock && <HowWeWork block={homePage.howWeWorkBlock} />}
        {homePage.featuredCaseStudiesBlock && (
          <CaseStudies block={homePage.featuredCaseStudiesBlock} lang="en" />
        )}
        {homePage.contentBlocks?.length ? <Content blocks={homePage.contentBlocks} /> : null}
        {homePage.faqSection && <Faq section={homePage.faqSection} />}
        {homePage.parallaxImage && <ParallaxBand image={homePage.parallaxImage} />}
        <Form lang="en" />

        <span className="preview-badge">Preview · Hero → Form</span>
      </main>
    </>
  );
}
