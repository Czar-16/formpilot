export async function database() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("formpilot-files", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("files", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function run(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode);
      let result;
      const request = action(tx.objectStore("files"));
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("File storage transaction aborted"));
    });
  } finally {
    db.close();
  }
}
export const getFile = (id) => run("readonly", (s) => s.get(id));
export const putFile = (record) => run("readwrite", (s) => s.put(record));
export const deleteFile = (id) => run("readwrite", (s) => s.delete(id));
export async function encode(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let result = "";
  for (let i = 0; i < bytes.length; i += 32768)
    result += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(result);
}
export function decode(value) {
  if (
    typeof value !== "string" ||
    value.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error("Invalid file encoding");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
