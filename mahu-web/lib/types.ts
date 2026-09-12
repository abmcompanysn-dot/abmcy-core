// Miroir de internal/content/service.go (type Article) côté backend Go.
export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  category?: string;
  region?: string;
  cover_image_url?: string;
  status: "draft" | "published";
  is_featured: boolean;
  view_count: number;
  author_staff_id?: string;
  published_at?: string;
}

export interface ArticleListFilter {
  category?: string;
  region?: string;
}
