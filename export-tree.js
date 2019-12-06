const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path")
const mkdirSync = require('mkdir-recursive').mkdirSync;
const script = path.basename(process.argv[1]);

const AM_BASE_URL = "https://default.iam.example.com/am";
const AM_PASSWORD = "password";

const USAGE = `Exports JSON configuration files for an authentication tree, its individual nodes, and supporting scripts.

Usage:
node ${script} <tree_name> <output_directory>

Example:
node ${script} UsernamePassword ~/repos/forgeops-init/forgecloud/default/am/realms/root
`;

try {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(USAGE);
    return;
  }

  main(args[0], args[1]);
} catch (error) {
  console.error(error);
}

async function main(treeName, outDir) {
  const ssoToken = await getSession();
  const tree = await getTree(treeName, ssoToken);
  await storeEntity('AuthTree', tree, outDir);
  await processChildren(tree, outDir, ssoToken);
  console.log('Done!');
}

async function processChildren(entity, outDir, ssoToken) {
  let children = [];
  if (Array.isArray(entity.data.nodes)) {
    children = entity.data.nodes.map(x => ({
      id: x._id,
      nodeType: x.nodeType,
    }));
  } else {
    for (const id in entity.data.nodes) {
      let { nodeType } = entity.data.nodes[id];
      children.push({ id, nodeType });
    }
  }

  for (const child of children) {
    const node = await getNode(child.nodeType, child.id, ssoToken);
    await storeEntity(child.nodeType, node, outDir);
    await processChildren(node, outDir, ssoToken);
  }

  if (entity.data.script) {
    const script = await getScript(entity.data.script, ssoToken);
    await storeEntity('Scripts', script, outDir);
  }
}

async function getTree(name, ssoToken) {
  const url = `${AM_BASE_URL}/json/realms/root/realm-config/authentication/authenticationtrees/trees/${name}`;
  const data = await request(url, ssoToken);
  delete data._rev;
  return {
    data,
    metadata: {
      realm: "/",
      amsterVersion: "&{version}",
      entityType: "AuthTree",
      entityId: data._id,
      pathParams: {}
    }
  };
}

async function getNode(type, id, ssoToken) {
  const url = `${AM_BASE_URL}/json/realms/root/realm-config/authentication/authenticationtrees/nodes/${type}/${id}`;
  const data = await request(url, ssoToken);
  delete data._rev;
  delete data.password;
  delete data['password-encrypted'];
  return {
    data,
    metadata: {
      realm: "/",
      amsterVersion: "&{version}",
      entityType: getEntityType(type),
      entityId: data._id,
      pathParams: {}
    },
  };
}

async function getScript(id, ssoToken) {
  const url = `${AM_BASE_URL}/json/scripts/${id}`;
  const data = await request(url, ssoToken);
  return {
    data,
    metadata: {
      realm: "/",
      amsterVersion: "&{version}",
      entityType: "Scripts",
      entityId: id,
      pathParams: {}
    },
  };
}

async function request(url, ssoToken) {
  const init = {
    headers: {
      iplanetdirectorypro: ssoToken
    },
    method: "GET",
  };

  const res = await _fetch(url, init);

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to get ${url}\nStatus: ${res.status}\nBody: ${body}`);
    throw new Error(`REST call failed`);
  }

  const json = await res.json();
  return json;
}

async function getSession() {
  const url = `${AM_BASE_URL}/json/realms/root/authenticate`;
  const init = {
    headers: {
      "accept-api-version": "resource=2.0,protocol=1.0",
      "x-openam-username": "amadmin",
      "x-openam-password": AM_PASSWORD
    },
    method: "POST"
  };

  const res = await _fetch(url, init);

  if (!res.ok) {
    console.error(await res.text());
    throw new Error("Failed to get session");
  }

  const json = await res.json();
  return json.tokenId;
}

async function _fetch(url, init) {
  if (url.startsWith("https:")) {
    const https = require("https");
    init.agent = new https.Agent({ rejectUnauthorized: false });
  }
  const res = await fetch(url, init);
  return res;
}

async function storeEntity(nodeDirName, entity, outDir) {
  const { entityId } = entity.metadata;
  const entityDir = path.resolve(outDir, nodeDirName);
  mkdirSync(entityDir);
  const filePath = path.resolve(entityDir, `${entityId}.json`)
  return createFile(entity, filePath);
}

function createFile(entity, filePath) {
  fs.writeFileSync(filePath, stringify(entity));
  console.log(`Saved ${filePath}`);
}

function getEntityType(nodeType) {
  switch (nodeType) {
    case 'PageNode':
    case 'WebAuthnAuthenticationNode':
    case 'WebAuthnRegistrationNode':
      return nodeType;
    case 'OneTimePasswordGeneratorNode':
      return 'HOTPGenerator';
    case 'OneTimePasswordSmtpSenderNode':
      return 'OTPEmailSender';
    case 'OneTimePasswordCollectorDecisionNode':
      return 'OTPCollectorDecision';
    case 'OneTimePasswordSmsSenderNode':
      return 'OTPSMSSender';
    case 'KbaCreateNode':
      return 'KBADefinition';
    case 'KbaDecisionNode':
      return 'KBADecision';
    case 'KbaVerifyNode':
      return 'KBAVerification';
    case 'ValidatedUsernameNode':
      return 'PlatformUsername';
    case 'ValidatedPasswordNode':
      return 'PlatformPassword';
    default:
      return nodeType.replace(/Node$/, '');
  }
}

function stringify(obj) {
  return JSON.stringify(obj, null, 2);
}