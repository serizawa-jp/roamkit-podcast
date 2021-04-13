import axios from "axios";

const log = (s) => {
    if (window.roamkit_podcat_debug === undefined || !window.roamkit_podcat_debug) return;
    console.log(`[podcast] ${s}`);
}

if (window.roamkit_podcast === undefined) window.roamkit_podcast = {};

roamkit_podcast.extractMetadata = async (currentElement, blockUid): any => {
    if (currentElement === undefined) return;
    const links = window.linkify.find(currentElement.value);
    if (links.length === 0) return;
    const src = links[0].href;
    log(`src: ${src}`);

    try {
        await fetchMetadata(src, writeMetadata(blockUid));
    } catch (e) {
        log(`failed to fetch metatags: ${e}`);
    }
}

var loadingCounter = 0;
const interval = setInterval(async () => {
    if (roam42.keyevents) {
        clearInterval(interval);
        roam42.loader.addScriptToPage('linkifyjs', 'https://cdn.jsdelivr.net/npm/linkifyjs@2.1.9/dist/linkify.min.js');
        roam42.loader.addScriptToPage('jsmediatags', 'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js');
    }
    if (loadingCounter > 20) { clearInterval(interval) } else { loadingCounter += 1 };
}, 5000);

const createBlock = (text, children?) => ({ text, children });
const writeBlock = (block, parentUid, order) => {
    if (block.uid === undefined) block.uid = roam42.common.createUid();

    window.roamAlphaAPI.createBlock({
        "location": {
            "parent-uid": parentUid,
            "order": order,
        },
        "block": { "string": block.text, "uid": block.uid }
    })
    if (block.children === undefined) return;

    block.children.forEach((c, idx) => writeBlock(c, block.uid, idx));
}

const writeMetadata = (blockUid) => {
    return async (res) => {
        const b = createBlock;

        log(JSON.stringify(res));
        const block = b("Meatadata:", [
            b(`Title: ${res.title}`),
            b(`Album: ${res.album}`),
            b(`Chapters:`,
                res.chapters.map(c => b(c))
            ),
        ]);
        log(JSON.stringify(block));
        writeBlock(block, blockUid, 0);
    }
}

const fetchMetadata = async (src, cb) => {
    await axios
        .get(src, { responseType: "blob" })
        .then(r => r.data)
        .then(async b => {
            new Promise((resolve, reject) => {
                new jsmediatags.Reader(b)
                    .read({
                        onSuccess: (tag) => {
                            resolve(tag);
                        },
                        onError: (error) => {
                            reject(error);
                        }
                    });
            })
                .then(tagInfo => {
                    try {
                        const tags = tagInfo.tags;
                        const title = tags.title;
                        const album = tags.album;
                        const chapters = tags.CHAP
                            .filter(c => c.id === "CHAP")
                            .map(c => ({ startTime: c.data.startTime, title: c.data.subFrames.TIT2.data }))
                            .map(c => {
                                const timeStr = new Date(c.startTime).toISOString().substr(11, 8)
                                return [timeStr, c.title].join(" ");
                            });
                        const res = {
                            title,
                            album,
                            chapters,
                        }
                        cb(res);
                    } catch (e) {
                        log(`failed to parses chapter: ${e}`);
                    }
                })
                .catch(error => {
                    log(`jsmediatagsError: ${error}`);
                });
        });
}