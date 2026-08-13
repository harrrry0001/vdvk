import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  className?: string;
  fillHeight?: boolean;
};

export function DataTable<TData>({
  columns,
  data,
  searchable = false,
  searchPlaceholder = "Search...",
  pageSize = 10,
  className,
  fillHeight = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 overflow-hidden", fillHeight && "flex flex-col h-full", className)}>
      {searchable && (
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-10 py-2 text-sm
                         bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/10
                         focus:border-charcoal/30 transition-all placeholder:text-gray-400"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={
                      "bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-4 py-3 border-b border-gray-200" +
                      (header.column.getCanSort() ? " cursor-pointer select-none" : "")
                    }
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="flex flex-col -space-y-1">
                          <ChevronUp
                            className={cn(
                              "w-3 h-3",
                              header.column.getIsSorted() === "asc"
                                ? "text-charcoal"
                                : "text-gray-300"
                            )}
                          />
                          <ChevronDown
                            className={cn(
                              "w-3 h-3",
                              header.column.getIsSorted() === "desc"
                                ? "text-charcoal"
                                : "text-gray-300"
                            )}
                          />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 hover:bg-gray-50/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-400 text-sm">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          {" \u2013 "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}
          {" of "}
          {table.getFilteredRowModel().rows.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: table.getPageCount() }, (_, i) => (
            <button
              key={i}
              onClick={() => table.setPageIndex(i)}
              className={cn(
                "w-8 h-8 rounded text-xs font-medium transition-colors",
                table.getState().pagination.pageIndex === i
                  ? "bg-charcoal text-golden"
                  : "hover:bg-gray-100 text-gray-600"
              )}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
