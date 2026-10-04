// BlogPostsRenderer.tsx
"use client";

import React, { FC, useState } from "react";
import styles from "./BlogPostsRenderer.module.scss";
import { Blog } from "@/types/blog";
import Link from "next/link";
import { urlFor } from "@/sanity/sanity.client";
import Image from "next/image";
import ButtonPrimary from "../ButtonPrimary/ButtonPrimary";
import { localePrefix, isLocale, type Locale } from "@/lib/locale";
import { blurProps } from "@/lib/imageBlur";

type Props = {
  blogPosts: Blog[];
  totalPosts: number;
  lang: string;
};

const INITIAL = 12;
const LIMIT = 9;

// Copy table for this renderer. `filterAll` was a `lang === "de" ? … : …`
// ternary inline in the category tab below (Hebrew Localization Phase 4, WP4)
// and is lifted here so every locale — `he` included — is enumerated in one
// place instead of falling through to English.
const BLOG_POSTS_EN = {
  loadMore: (n: number) => `Load ${n} more posts`,
  filterAll: "All",
};

const BLOG_POSTS_COPY: Record<Locale, typeof BLOG_POSTS_EN> = {
  en: BLOG_POSTS_EN,
  de: { loadMore: (n) => `Noch ${n} Beiträge laden`, filterAll: "Alle" },
  ru: { loadMore: (n) => `Загрузить ещё ${n} постов`, filterAll: "Все" },
  pl: { loadMore: (n) => `Załaduj jeszcze ${n} postów`, filterAll: "Wszystkie" },
  he: { loadMore: (n) => `הצגת עוד ${n} מאמרים`, filterAll: "הכל" }, // REVIEW(he)
};

const copy = (lang: string) => BLOG_POSTS_COPY[isLocale(lang) ? lang : "en"];

// All posts are rendered server-side (every link is crawlable); the client only reveals more of
// the already-rendered cards. Cards beyond `visibleCount` carry the `hidden` attribute, so they
// stay in the DOM (discoverable) but out of view until "load more".
const BlogPostsRenderer: FC<Props> = ({ blogPosts, lang }) => {
  const posts = blogPosts;
  const [visibleCount, setVisibleCount] = useState(INITIAL);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB").replace(/\//g, ".");
  };

  const generateSlug = (slug: any, language: string) =>
    slug?.[language]?.current
      ? `${localePrefix(language)}/blog/${slug[language].current}`
      : "#";

  const getLoadMoreText = () => copy(lang).loadMore(LIMIT);

  const loadMorePosts = () => setVisibleCount((c) => c + LIMIT);

  // категории для табов (посты без категории не ломают рендер)
  const categories = Array.from(
    new Set(
      posts
        .map((post) => post.category?.title)
        .filter((title): title is string => Boolean(title))
    )
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat);
    setVisibleCount(INITIAL);
  };
  const filteredPosts = selectedCategory
    ? posts.filter((p) => p.category?.title === selectedCategory)
    : posts;

  return (
    <div className={styles.blogPostsRenderer}>
      {/* Табы категорий */}
      <div className={styles.tabsBlock}>
        <div className="container">
          <div className={styles.tabs}>
            <button
              className={`${!selectedCategory ? styles.active : ""} ${styles.tab}`}
              onClick={() => selectCategory(null)}
            >
              {copy(lang).filterAll}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`${selectedCategory === cat ? styles.active : ""} ${styles.tab}`}
                onClick={() => selectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Список статей */}
      <div className={styles.articlesBlock}>
        <div className="container">
          <div className={styles.articles}>
            {filteredPosts.map((post, index) => {
              // Ссылка-заглушка
              const PLACEHOLDER =
                "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

              // Попытаемся взять asset._ref; если его нет — сразу в заглушку
              const hasValidImage = Boolean(post.previewImage?.asset?._ref);

              // Если asset._ref есть – формируем URL, иначе – плейсхолдер
              const imageUrl = hasValidImage
                ? urlFor(post.previewImage).url()
                : PLACEHOLDER;

              return (
                <Link
                  href={generateSlug(post.slug, lang)}
                  key={post._id}
                  className={styles.article}
                  hidden={index >= visibleCount}
                >
                  <div className={styles.imageBlock}>
                    <Image
                      alt={post.title}
                      src={imageUrl}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className={styles.image}
                      {...blurProps(post.previewImage)}
                    />
                  </div>
                  <div className={styles.overlay}></div>
                  <div className={styles.content}>
                    <div className={styles.contentWrapper}>
                      <div className={styles.contentTop}>
                        {post.category?.title && (
                          <p className={styles.articleCategory}>
                            {post.category.title}
                          </p>
                        )}
                      </div>
                      <div className={styles.contentBottom}>
                        <p className={styles.articleDate}>
                          {formatDate(post.publishedAt)}
                        </p>
                        <h3 className={styles.articleTitle}>{post.title}</h3>
                        <p className={styles.excerpt}>{post.excerpt}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Кнопка «загрузить ещё» */}
          <div className={styles.loadingBlock}>
            {visibleCount < filteredPosts.length && (
              <ButtonPrimary
                onClick={loadMorePosts}
                className={styles.loadMoreButton}
              >
                {getLoadMoreText()}
              </ButtonPrimary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPostsRenderer;
