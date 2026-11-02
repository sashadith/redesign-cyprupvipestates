// Guide article URL in one language (see ../../blog/guideRoute.tsx): ratgeber.
import { GuidePage, guideMetadata, guideStaticParams } from "../../blog/guideRoute";

export const revalidate = 3600;
export const generateStaticParams = () => guideStaticParams("ratgeber");
export const generateMetadata = (props: { params: { lang: string; slug: string } }) => guideMetadata(props, "ratgeber");
export default function Page(props: { params: { lang: string; slug: string } }) {
  return GuidePage(props, "ratgeber");
}
