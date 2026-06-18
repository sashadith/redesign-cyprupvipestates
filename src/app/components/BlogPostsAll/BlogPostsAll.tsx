import { Blog } from "@/types/blog";
import React, { FC } from "react";
import styles from "./BlogPostsAll.module.scss";
import BlogPostsRenderer from "../BlogPostsRenderer/BlogPostsRenderer";

type Props = {
  title: string;
  blogPosts: Blog[];
  totalPosts: number;
  lang: string;
};

const BlogPostsAll: FC<Props> = ({ title, blogPosts, totalPosts, lang }) => {
  return (
    <section className={styles.blogPosts}>
      <div className="container">
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
      <BlogPostsRenderer
        blogPosts={blogPosts}
        totalPosts={totalPosts}
        lang={lang}
      />
    </section>
  );
};

export default BlogPostsAll;
