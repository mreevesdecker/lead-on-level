/**
 * Lead on Level · System & Soul — response collector.
 *
 * Paste this into Extensions → Apps Script on a Google Sheet, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into assets/config.js as ENDPOINT.
 *
 * Two tabs are created automatically:
 *   Responses – one row per person (updated as they go)
 *   Items     – one row per statement they rated
 */
var TOKEN = "oa-Kaxacz_VOY7FdXzDaYRDu"; // must match TOKEN in assets/config.js

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return json_({ ok: false, error: "bad token" });
    var r = body.response || {};
    if (!r.session_id) return json_({ ok: false, error: "missing session" });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    r.state_json = JSON.stringify(body.state || {}).slice(0, 49000);
    upsertRow_(sheet_(ss, "Responses"), r);
    replaceItems_(sheet_(ss, "Items"), r.session_id, body.items || []);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function doGet() {
  return json_({ ok: true, service: "lead-on-level" });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Make sure every key has a column; returns the header list.
function headers_(sh, keys) {
  var h = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (h.indexOf("session_id") === -1 && !h.length) h = ["session_id"];
  var added = false;
  keys.forEach(function (k) { if (h.indexOf(k) === -1) { h.push(k); added = true; } });
  if (added || sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return h;
}

function upsertRow_(sh, obj) {
  var h = headers_(sh, Object.keys(obj));
  var row = h.map(function (k) { return obj[k] == null ? "" : obj[k]; });
  var col = h.indexOf("session_id") + 1;
  var last = sh.getLastRow();
  if (last > 1) {
    var found = sh.getRange(2, col, last - 1, 1).createTextFinder(String(obj.session_id)).matchEntireCell(true).findNext();
    if (found) { sh.getRange(found.getRow(), 1, 1, h.length).setValues([row]); return; }
  }
  sh.appendRow(row);
}

function replaceItems_(sh, sessionId, items) {
  if (!items.length) return;
  var h = headers_(sh, Object.keys(items[0]));
  var col = h.indexOf("session_id") + 1;
  var last = sh.getLastRow();
  if (last > 1) {
    var ids = sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(sessionId)) {
        // delete contiguous runs from the bottom up
        var end = i;
        while (i > 0 && String(ids[i - 1][0]) === String(sessionId)) i--;
        sh.deleteRows(i + 2, end - i + 1);
      }
    }
  }
  var rows = items.map(function (it) { return h.map(function (k) { return it[k] == null ? "" : it[k]; }); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, h.length).setValues(rows);
}
