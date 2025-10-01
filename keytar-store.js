import keytar from "keytar";

const SERVICE = "RD Companion";
const ACCOUNT = "RealDebridToken";

export async function getToken() {
  return keytar.getPassword(SERVICE, ACCOUNT);
}
export async function saveToken(token) {
  return keytar.setPassword(SERVICE, ACCOUNT, token);
}
export async function clearToken() {
  return keytar.deletePassword(SERVICE, ACCOUNT);
}
