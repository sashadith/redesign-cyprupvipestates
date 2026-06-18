import React, { FC } from "react";
import styles from "./LocationBlockComponent.module.scss";
import dynamic from "next/dynamic";
import { LocationBlock } from "@/types/blog";

type Props = {
  block: LocationBlock;
  lang: string;
};

const LocationBlockComponent: FC<Props> = ({ block, lang }) => {
  const MapWithNoSSR = dynamic(
    () => import("../../components/PropertyMap/PropertyMap"),
    {
      ssr: false,
    },
  );

  return (
    <div>
      <MapWithNoSSR
        lat={block.location.lat}
        lng={block.location.lng}
        lang={lang}
        showPopup={false}
      />
    </div>
  );
};

export default LocationBlockComponent;
