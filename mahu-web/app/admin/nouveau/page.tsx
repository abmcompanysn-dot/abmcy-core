import ArticleForm from "@/components/admin/ArticleForm";

export default function NewArticlePage() {
  return (
    <main className="mx-auto max-w-[700px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
        Nouvel article
      </h1>
      <ArticleForm />
    </main>
  );
}
