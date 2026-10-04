import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [], entries: [] },
  server: { middlewareMode: true, watch: null }
});
const profiles = await server.ssrLoadModule("/src/services/artistProfiles.ts");
const musicBrainz = await server.ssrLoadModule("/src/services/musicBrainz.ts");
const client = await server.ssrLoadModule("/src/services/musicBrainzClient.ts");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
after(async () => { await server.close(); });

test("any group gets members, former-member status, aliases, and attributed links", () => {
  const profile = profiles.profileFromEntity({ id: "group", name: "Example Group", scene: "kpop" }, {
    id: "group-mbid", name: "Example Group", type: "Group", aliases: [{ name: "EG" }],
    relations: [
      { type: "member of band", direction: "backward", "target-credit": "Member One", artist: { id: "one", name: "Member One" } },
      { type: "member of band", direction: "backward", ended: true, artist: { id: "two", name: "Member Two" } },
      { type: "member of band", direction: "forward", artist: { id: "parent", name: "Parent Group" } },
      { type: "social network", url: { resource: "https://www.instagram.com/example_group/" } }
    ]
  });
  assert.deepEqual(profile.members.map((member) => [member.name, member.former]), [["Member One", false], ["Member Two", true]]);
  assert.deepEqual(profile.aliases, ["EG"]);
  assert.equal(profile.sources[0].attributionUrl, "https://musicbrainz.org/artist/group-mbid");
  assert.equal(profile.sources[0].kind, "database");
});

test("rejects unsafe, lookalike, ended, and unrelated URLs", () => {
  const sources = profiles.sourcesFromRelations({ id: "test", relations: [
    { type: "social network", url: { resource: "javascript:alert(1)" } },
    { type: "social network", url: { resource: "https://instagram.com.evil.example/test" } },
    { type: "social network", ended: true, url: { resource: "https://instagram.com/old_account/" } },
    { type: "fanpage", url: { resource: "https://instagram.com/fan_account/" } },
    { type: "social network", url: { resource: "https://instagram.com/current_account/" } }
  ] });
  assert.equal(sources.filter((source) => source.id === "instagram").length, 1);
  assert.equal(sources[0].url, "https://instagram.com/current_account/");
});

test("missing platforms are searches and soloists do not inherit group members", () => {
  const artist = { id: "solo", name: "Solo Artist", scene: "kpop", members: [{ name: "Old Member", sources: [] }] };
  const profile = profiles.profileFromEntity(artist, { id: "solo-mbid", name: artist.name, type: "Person" });
  assert.deepEqual(profile.members, []);
  assert.equal(profiles.getArtistSources(profile).find((source) => source.id === "spotify").kind, "search");
  assert.equal(profiles.matchesArtistName({ ...artist, aliases: ["Stage-Name"] }, "stage name"), true);
  assert.equal(profiles.matchesArtistName(artist, "Different Artist"), false);
});

test("ambiguous artist names require an identity choice", async () => {
  globalThis.fetch = async () => Response.json({ artists: [
    { id: "a", name: "Ambiguous", country: "KR" }, { id: "b", name: "Ambiguous", country: "KR" }
  ] });
  await assert.rejects(musicBrainz.searchMusicBrainzArtist("Ambiguous"), /online search results/);
});

test("loads arbitrary member profiles progressively and retains partial data on failure", async () => {
  const updates = [];
  const order = [];
  globalThis.fetch = async (url) => {
    if (url.includes("artist/group-mbid?")) return Response.json({
      id: "group-mbid", name: "Other Group", type: "Group", relations: [
        { type: "member of band", direction: "backward", artist: { id: "member-one", name: "One" } },
        { type: "member of band", direction: "backward", artist: { id: "member-two", name: "Two" } }
      ]
    });
    order.push(url);
    if (url.includes("member-two")) return new Response("Unavailable", { status: 503 });
    return Response.json({ id: "member-one", name: "One", relations: [
      { type: "social network", url: { resource: "https://www.instagram.com/member_one/" } }
    ] });
  };
  await assert.rejects(profiles.fetchArtistProfile({ id: "other", name: "Other Group", scene: "kpop", musicBrainzId: "group-mbid" },
    new AbortController().signal, (profile) => updates.push(profile), async () => { order.push("releases"); }), /Two/);
  assert.equal(order[0], "releases");
  assert.equal(updates[0].members.length, 2);
  assert.equal(updates.at(-1).members[0].sources[0].id, "instagram");
  assert.equal(updates.at(-1).membersComplete, false);
});

test("queued requests cancelled by artist switching never fetch", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.musicBrainzRequest("artist/cancelled", {}, controller.signal), /abort/i);
  assert.equal(calls, 0);
});
