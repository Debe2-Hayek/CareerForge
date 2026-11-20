import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { productRoadmap } from "../src/lib/product-roadmap";

test("the feedback RPC allowlist matches every explicitly curated roadmap node", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/202611200001_product_evolution.sql", import.meta.url),
    "utf8"
  );
  const allowlist = migration.match(/if p_node_id not in \((?<ids>[\s\S]*?)\) then raise invalid_parameter_value;/)?.groups?.ids;
  assert.ok(allowlist, "The feedback RPC must retain its explicit node allowlist.");
  const databaseIds = [...allowlist.matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]).sort();
  const roadmapIds = productRoadmap.nodes.filter(node => node.acceptsFeedback).map(node => node.id).sort();
  assert.deepEqual(databaseIds, roadmapIds);
});
