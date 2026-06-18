// BlogPostsRenderer.tsx
"use client";

import React, { FC, useState } from "react";
import styles from "./BlogPostsRenderer.module.scss";
import { Blog } from "@/types/blog";
import Link from "next/link";
import { urlFor } from "@/sanity/sanity.client";
import Image from "next/image";
import axios from "axios";
import ButtonPrimary from "../ButtonPrimary/ButtonPrimary";

type Props = {
  blogPosts: Blog[];
  totalPosts: number;
  lang: string;
};

const LIMIT = 9;

const BlogPostsRenderer: FC<Props> = ({ blogPosts, totalPosts, lang }) => {
  const [posts, setPosts] = useState<Blog[]>(blogPosts);
  const [loading, setLoading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB").replace(/\//g, ".");
  };

  const generateSlug = (slug: any, language: string) =>
    slug?.[language]?.current
      ? `/${language}/blog/${slug[language].current}`
      : "#";

  const getLoadMoreText = () => {
    switch (lang) {
      case "de":
        return `Noch ${LIMIT} Beiträge laden`;
      case "ru":
        return `Загрузить ещё ${LIMIT} постов`;
      case "pl":
        return `Załaduj jeszcze ${LIMIT} postów`;
      case "en":
      default:
        return `Load ${LIMIT} more posts`;
    }
  };

  const loadMorePosts = async () => {
    setLoading(true);
    const offset = posts.length;

    try {
      const { data } = await axios.get(
        `/api/getMorePosts?lang=${lang}&limit=${LIMIT}&offset=${offset}`
      );
      const newPosts: Blog[] = data.posts;
      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      console.error("Error loading more posts:", err);
    } finally {
      setLoading(false);
    }
  };

  // категории для табов
  const categories = Array.from(
    new Set(posts.map((post) => post.category.title))
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const filteredPosts = selectedCategory
    ? posts.filter((p) => p.category.title === selectedCategory)
    : posts;

  return (
    <div className={styles.blogPostsRenderer}>
      {/* Табы категорий */}
      <div className={styles.tabsBlock}>
        <div className="container">
          <div className={styles.tabs}>
            <button
              className={`${!selectedCategory ? styles.active : ""} ${styles.tab}`}
              onClick={() => setSelectedCategory(null)}
            >
              {lang === "de"
                ? "Alle"
                : lang === "ru"
                  ? "Все"
                  : lang === "pl"
                    ? "Wszystkie"
                    : "All"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`${selectedCategory === cat ? styles.active : ""} ${styles.tab}`}
                onClick={() => setSelectedCategory(cat)}
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
            {filteredPosts.map((post) => {
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
                >
                  <div className={styles.imageBlock}>
                    <Image
                      alt={post.title}
                      src={imageUrl}
                      fill
                      className={styles.image}
                    />
                  </div>
                  <div className={styles.overlay}></div>
                  <div className={styles.content}>
                    <div className={styles.contentWrapper}>
                      <div className={styles.contentTop}>
                        <p className={styles.articleCategory}>
                          {post.category.title}
                        </p>
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
            <div className={styles.loaderWrapper}>
              {loading && (
                <div className={styles.loader}>{/* ваш лоадер */}</div>
              )}
            </div>
            {!loading && posts.length < totalPosts && (
              <ButtonPrimary
                onClick={loadMorePosts}
                disabled={loading}
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
