import { exec } from "child_process";
import { CronJob } from "cron";
import { readFile } from "fs/promises";
import process from "process";

const args = process.argv.slice(2);

(async () => {
    const { repo, clearFolder } = await getConfigFile();

    console.log(`${getTS()} : Starting CICD`);

    let version = "";

    let runingInstance = false;

    await execute(`git ls-remote ${repo}  main`, (stdout) => {
        version = stdout.split("refs")[0].trim();
    });

    console.log(`${getTS()} : version initialized`);

    const job = new CronJob(
        "* * * * *", // cronTime
        async function () {
            if (!version) {
                await execute(`git ls-remote ${repo}  main`, (stdout) => {
                    version = stdout.split("refs")[0].trim();
                });
                console.log(`${getTS()} : version initialized`);
            }

            await execute(`git ls-remote ${repo}  main`, async (stdout) => {
                const currversion = stdout.split("refs")[0].trim();

                if (currversion !== version) {
                    if (runingInstance) {
                        console.log(`${getTS()} : CICD Instance already running aborting process`);
                        return;
                    }

                    console.log(`${getTS()} : Repo Version Changed Starting Update`);

                    runingInstance = true;

                    const operation = await buildAndSetUp();

                    if (operation) {
                        console.log(`${getTS()} : Updates Finished`);
                        version = currversion;
                        runingInstance = false;

                        if (clearFolder) {
                            await execute(`rm -rf ${clearFolder}`);
                        }
                        return;
                    }
                }
                console.log(`${getTS()} : Checked ${repo} No Updates`);
            });
        }, // onTick
        null, // onComplete
        true, // start
        "Africa/Algiers" // timeZone
    );

    async function buildAndSetUp() {
        const { build, mouve, repo } = await getConfigFile();

        const cloning = await execute(`git clone ${repo}`);

        if (!cloning) {
            console.log(`${getTS()} : Error Cloning ${repo} `);
            return false;
        }

        console.log(`${getTS()} : cloned ${repo} `);

        if (!args) {
            console.log(`${getTS()} : you need to provide the '--file' argument for the program to work`);
            return false;
        }

        const building = await buildFolders(build);

        if (!building) {
            console.log(`${getTS()} : Error While Building Files`);
            return false;
        }
        const moving = await moveToFolders(mouve);
        return moving;
    }

    async function buildFolders(folders) {
        return new Promise(async (resolve, reject) => {
            for await (const folder of folders) {
                const { workDir, cmd } = folder;
                for await (const cm of cmd) {
                    const build = await execute(cm.trim(), null, { cwd: workDir });
                    if (!build) {
                        console.log(`${getTS()} : Error Executing  ${cm} on ${workDir}`);
                        resolve(false);
                        return;
                    }
                    console.log(`${getTS()} : Executed  ${cm} on ${workDir}`);
                }
            }
            resolve(true);
            return;
        });
    }

    async function moveToFolders(folders) {
        return new Promise(async (resolve, reject) => {
            for await (const folder of folders) {
                const move = await execute(folder.trim());
                if (!move) {
                    console.log(`${getTS()} : Error Executing  ${folder} `);
                    resolve(false);
                    return;
                }
                console.log(`${getTS()} : Executed  ${folder} `);
            }
            return resolve(true);
        });
    }

    function getObjectFromArgs(argument) {
        let obj = {};

        for (let i = 0; i < argument.length; i++) {
            if (argument[i].includes("--") && argument[i + 1] && !argument[i + 1].includes("--")) {
                const key = argument[i].toLowerCase().split("-")[2];
                const val = argument[i + 1];
                obj = { ...obj, [key]: val };
                i += 1;
            }
        }

        return obj;
    }
    async function getConfigFile() {
        try {
            const { config } = getObjectFromArgs(args);
            const fileTxt = await readFile(config);
            if (!fileTxt) {
                console.log(`${getTS()} : error no config file with this name : ${config}`);
                return;
            }
            return JSON.parse(fileTxt);
        } catch (error) {
            console.log("🚀 ~ file: Index2.js:142 ~ getConfigFile ~ error:", error);
        }
    }
    async function execute(commande, cb, ops) {
        return new Promise(async (resolve, reject) => {
            try {
                exec(commande, { ...ops }, async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`${getTS()} : Error executing the script: ${error}`);
                    }
                    if (stderr) {
                        // console.log("🚀 ~ file: Index.js:24 ~ exec ~ stderr:", stderr);
                    }
                    if (stdout) {
                        // console.log("🚀 ~ file: Index.js:24 ~ exec ~ stdout:", stdout);
                    }
                    if (cb && stdout) {
                        await cb(stdout);
                    }
                }).on("exit", async (code) => {
                    const { clearFolder } = await getConfigFile();

                    if (code != 0) {
                        resolve(false);
                        if (clearFolder) {
                            await execute(`rm -rf ${clearFolder}`);
                        }
                        return;
                    }
                    resolve(true);
                });
            } catch (error) {
                console.log("🚀 ~ file: Index.js:172 ~ returnnewPromise ~ error:", error);
            }
        });
    }

    function getTS() {
        return new Date(Date.now()).toISOString();
    }
})();
