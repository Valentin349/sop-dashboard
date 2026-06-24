import { listCategories, listPlatforms, listSops } from "@/lib/sops/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder dashboard — plain SOP listing. Real UI lands once the design is provided.

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function Home() {
  const [sops, categories, platforms] = await Promise.all([
    listSops(),
    listCategories(),
    listPlatforms(),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name ?? `#${c.id}`]));
  const platformName = new Map(platforms.map((p) => [p.id, p.name ?? `#${p.id}`]));

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">SOP Dashboard</h1>
        <Badge variant="secondary">{sops.length} SOPs</Badge>
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-40">Platform</TableHead>
              <TableHead className="w-56">Category</TableHead>
              <TableHead className="w-28">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sops.map((sop) => (
              <TableRow key={sop.id}>
                <TableCell className="text-muted-foreground">{sop.id}</TableCell>
                <TableCell className="font-medium">{sop.title ?? "—"}</TableCell>
                <TableCell>
                  {sop.platform_id != null
                    ? platformName.get(sop.platform_id) ?? `#${sop.platform_id}`
                    : "—"}
                </TableCell>
                <TableCell>
                  {sop.category_id != null
                    ? categoryName.get(sop.category_id) ?? `#${sop.category_id}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(sop.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
