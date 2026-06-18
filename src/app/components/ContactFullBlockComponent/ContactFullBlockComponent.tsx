import React, { FC } from "react";
import styles from "./ContactFullBlockComponent.module.scss";
import { ContactFullBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { Contact } from "@/types/footer";
import FormFull from "../FormFull/FormFull";
import TrackedContactLink from "../TrackedContactLink/TrackedContactLink";

type Props = {
  block: ContactFullBlock;
  lang: string;
};

const ContactFullBlockComponent: FC<Props> = ({ block, lang }) => {
  // console.log("ContactFullBlockComponent", block);

  const cleanLink = (link: string) => {
    // Оставляем буквы, цифры, символы @ и +
    return link.replace(/[^a-zA-Z0-9@+]/g, "");
  };

  const getContactHref = (contact: Contact) => {
    const cleanedLabel = cleanLink(contact.label);

    switch (contact.type) {
      case "Email":
        return `mailto:${cleanedLabel}`;

      case "Phone":
        // Если это телефон, возвращаем ссылку для звонка
        return `tel:${cleanedLabel}`;

      case "Link":
        // Если в label содержится номер телефона, формируем ссылку на WhatsApp
        if (cleanedLabel.match(/^\+?\d+$/)) {
          const whatsappNumber = cleanedLabel.replace("+", ""); // Убираем плюс для WhatsApp
          return `https://wa.me/${whatsappNumber}`;
        }
        // Если это обычная ссылка, проверяем на наличие http/https
        return cleanedLabel.startsWith("http://") ||
          cleanedLabel.startsWith("https://")
          ? cleanedLabel
          : `https://${cleanedLabel}`;

      default:
        return "#";
    }
  };

  const { title, description, contacts, form } = block;
  return (
    <section className={styles.contactFull}>
      <div className="container">
        <div className={styles.wrapper}>
          <div className={styles.contactsBlock}>
            <p className={styles.description}>{description}</p>
            <div className={styles.contacts}>
              {contacts.map((contact) => (
                <TrackedContactLink
                  href={getContactHref(contact)}
                  key={contact._key}
                  className={styles.contact}
                  contactType={contact.type}
                  placement="contact_full_block"
                >
                  <Image
                    alt={contact.label}
                    src={urlFor(contact.icon).url()}
                    width={50}
                    height={50}
                    unoptimized
                  />
                  <p className={styles.contactLabel}>
                    {contact.title}: {contact.label}
                  </p>
                </TrackedContactLink>
              ))}
            </div>
          </div>
          <div className={styles.formBlock}>
            <FormFull form={block.form} lang={lang} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactFullBlockComponent;
