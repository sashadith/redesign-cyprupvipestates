// Guide article URL in one language (see ../../blog/guideRoute.tsx): gajdy.
import { GuidePage, guideMetadata, guideStaticParams } from "../../blog/guideRoute";

export const revalidate = 3600;
export const generateStaticParams = () => guideStaticParams("gajdy");
export const generateMetadata = (props: { params: { lang: string; slug: string } }) => guideMetadata(props, "gajdy");
export default function Page(props: { params: { lang: string; slug: string } }) {
  return GuidePage(props, "gajdy");
}
