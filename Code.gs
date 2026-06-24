/**
 * ===================================================
 * نظام محطات التوزيع والتحويل - الإصدار 7.2
 * شركة الكهرباء السعودية - جدة
 * مع نظام المراقبة المتقدم
 * ===================================================
 */

const CONFIG = {
  STATIONS_SHEET: 'احداثيات محطات التوزيع',
  SUBSTATIONS_SHEET: 'محطات التحويل',
  USERS_SHEET: 'المشتركين',
  LOGS_SHEET: 'السجلات',
  VISITS_SHEET: 'سجل الزيارات',
  ONLINE_SHEET: 'المتواجدون',
  SETTINGS_SHEET: 'الاعدادات',
  ERROR_LOG_SHEET: 'سجل_الاخطاء',
  API_STATS_SHEET: 'احصائيات_API'
};

// إعدادات المراقبة
const MONITORING = {
  ADMIN_EMAIL: '63656m@gmail.com',
  ALERT_ON_ERROR: true,
  DAILY_REPORT: true,
  HEALTH_CHECK_INTERVAL: 60, // بالدقائق
  MAX_ERRORS_BEFORE_ALERT: 3
};

// أعمدة جدول محطات التوزيع (حسب الصورة)
const COLS = {
  STATION_NUMBER: 0,  // A - رقم محطات التوزيع
  FEEDER: 1,          // B - المغذي
  REGION: 2,          // C - الحي
  GOOGLE_MAP: 3,      // D - google map
  LOCATION_LINK: 4,   // E - رابط الموقع على الطبيعة
  LAT: 5,             // F - خط العرض
  LNG: 6,             // G - خط الطول
  DATE: 7,            // H - التاريخ
  TIME: 8,            // I - الوقت
  USER_NAME: 9,       // J - الاسم
  USER_EMAIL: 10,     // K - الايميل
  REASON: 11          // L - السبب
};

// أعمدة جدول محطات التحويل
const SUB_COLS = {
  SHORT_NAME: 0,      // A - اختصار اسم محطة التحويل
  GOOGLE_MAP: 1,      // B - google map
  LOCATION_LINK: 2,   // C - رابط الموقع على الطبيعة
  LAT: 3,             // D - خط العرض
  LNG: 4,             // E - خط الطول
  DATE: 5,            // F - التاريخ
  TIME: 6,            // G - الوقت
  USER_NAME: 7,       // H - الاسم
  USER_EMAIL: 8,      // I - الايميل
  REASON: 9           // J - السبب
};

// ===================================================
// عداد طلبات API
// ===================================================

/**
 * تسجيل طلب API
 */
function recordApiRequest(action, method) {
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
    var key = 'API_REQUESTS_' + today;
    
    var current = parseInt(props.getProperty(key) || '0');
    props.setProperty(key, String(current + 1));
    
    // تسجيل تفصيلي بالساعة
    var hour = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'HH');
    var hourKey = 'API_HOUR_' + today + '_' + hour;
    var hourCount = parseInt(props.getProperty(hourKey) || '0');
    props.setProperty(hourKey, String(hourCount + 1));
    
  } catch (e) {
    // تجاهل الأخطاء في التسجيل حتى لا يؤثر على الطلب الأصلي
  }
}

/**
 * الحصول على إحصائيات الطلبات اليومية
 */
function getApiStats() {
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
    var todayKey = 'API_REQUESTS_' + today;
    var todayCount = parseInt(props.getProperty(todayKey) || '0');
    
    // إحصائيات الأيام السابقة
    var stats = {
      today: todayCount,
      todayDate: today,
      limit: 20000,
      percentage: Math.round((todayCount / 20000) * 100),
      hourly: []
    };
    
    // إحصائيات كل ساعة لليوم
    for (var h = 0; h < 24; h++) {
      var hourStr = h < 10 ? '0' + h : String(h);
      var hourKey = 'API_HOUR_' + today + '_' + hourStr;
      var hourCount = parseInt(props.getProperty(hourKey) || '0');
      stats.hourly.push({ hour: hourStr + ':00', count: hourCount });
    }
    
    // آخر 7 أيام
    stats.weekly = [];
    for (var d = 6; d >= 0; d--) {
      var date = new Date();
      date.setDate(date.getDate() - d);
      var dateStr = Utilities.formatDate(date, 'Asia/Riyadh', 'yyyy-MM-dd');
      var dayKey = 'API_REQUESTS_' + dateStr;
      var dayCount = parseInt(props.getProperty(dayKey) || '0');
      stats.weekly.push({ date: dateStr, count: dayCount });
    }
    
    return { success: true, stats: stats };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * مسح إحصائيات قديمة (أكثر من 30 يوم)
 */
function cleanOldApiStats() {
  try {
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    
    for (var key in allProps) {
      if (key.startsWith('API_REQUESTS_') || key.startsWith('API_HOUR_')) {
        var dateStr = key.split('_')[2];
        if (dateStr && new Date(dateStr) < cutoff) {
          props.deleteProperty(key);
        }
      }
    }
  } catch (e) {}
}

// ===================================================
// نظام الإصدار - محسّن باستخدام PropertiesService
// ===================================================
function getDataVersion() {
  // استخدام PropertiesService بدلاً من قراءة Sheet - أسرع 10 مرات!
  var props = PropertiesService.getScriptProperties();
  var version = props.getProperty('DATA_VERSION');
  if (!version) {
    version = Date.now().toString();
    props.setProperty('DATA_VERSION', version);
  }
  return { version: version };
}

function incrementDataVersion() {
  // تحديث الإصدار عند أي تعديل على البيانات
  var newVersion = Date.now().toString();
  PropertiesService.getScriptProperties().setProperty('DATA_VERSION', newVersion);
  return newVersion;
}

// ===================================================
// نظام المراقبة المتقدم
// ===================================================

/**
 * إنشاء ورقة سجل الأخطاء إذا لم تكن موجودة
 */
function getOrCreateErrorLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.ERROR_LOG_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ERROR_LOG_SHEET);
    sheet.appendRow(['التاريخ', 'الوقت', 'نوع الخطأ', 'التفاصيل', 'المستخدم', 'تم الإشعار']);
    sheet.getRange(1, 1, 1, 6).setBackground('#e57373').setFontColor('white').setFontWeight('bold');
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 80);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 300);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 80);
  }
  
  return sheet;
}

/**
 * تسجيل خطأ في السجل
 */
function logError(errorType, details, userName) {
  try {
    var sheet = getOrCreateErrorLogSheet();
    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss');
    
    sheet.appendRow([dateStr, timeStr, errorType, details, userName || 'غير معروف', 'لا']);
    
    // التحقق من عدد الأخطاء اليوم
    checkErrorThreshold();
    
    return true;
  } catch (e) {
    console.error('فشل تسجيل الخطأ:', e);
    return false;
  }
}

/**
 * التحقق من تجاوز حد الأخطاء وإرسال تنبيه
 */
function checkErrorThreshold() {
  try {
    var sheet = getOrCreateErrorLogSheet();
    var data = sheet.getDataRange().getValues();
    var today = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
    
    var todayErrors = 0;
    var unnotifiedErrors = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === today) {
        todayErrors++;
        if (data[i][5] === 'لا') {
          unnotifiedErrors.push({
            row: i + 1,
            time: data[i][1],
            type: data[i][2],
            details: data[i][3],
            user: data[i][4]
          });
        }
      }
    }
    
    // إرسال تنبيه إذا تجاوز الحد
    if (unnotifiedErrors.length >= MONITORING.MAX_ERRORS_BEFORE_ALERT) {
      sendErrorAlert(unnotifiedErrors, todayErrors);
      
      // تحديث حالة الإشعار
      for (var j = 0; j < unnotifiedErrors.length; j++) {
        sheet.getRange(unnotifiedErrors[j].row, 6).setValue('نعم');
      }
    }
  } catch (e) {
    console.error('فشل التحقق من الأخطاء:', e);
  }
}

/**
 * إرسال تنبيه بالأخطاء للمدير
 */
function sendErrorAlert(errors, totalToday) {
  try {
    var subject = '⚠️ تنبيه - أخطاء في نظام محطات SEC';
    
    var body = '<div dir="rtl" style="font-family: Arial, sans-serif;">';
    body += '<h2 style="color: #e57373;">⚠️ تنبيه - تم اكتشاف أخطاء</h2>';
    body += '<p><strong>إجمالي أخطاء اليوم:</strong> ' + totalToday + '</p>';
    body += '<hr>';
    body += '<h3>تفاصيل الأخطاء الجديدة:</h3>';
    body += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
    body += '<tr style="background: #f5f5f5;"><th>الوقت</th><th>نوع الخطأ</th><th>التفاصيل</th><th>المستخدم</th></tr>';
    
    for (var i = 0; i < errors.length; i++) {
      body += '<tr>';
      body += '<td>' + errors[i].time + '</td>';
      body += '<td>' + errors[i].type + '</td>';
      body += '<td>' + errors[i].details + '</td>';
      body += '<td>' + errors[i].user + '</td>';
      body += '</tr>';
    }
    
    body += '</table>';
    body += '<hr>';
    body += '<p style="color: #666; font-size: 12px;">هذا تنبيه تلقائي من نظام مراقبة محطات SEC</p>';
    body += '</div>';
    
    MailApp.sendEmail({
      to: MONITORING.ADMIN_EMAIL,
      subject: subject,
      htmlBody: body
    });
    
    console.log('تم إرسال تنبيه الأخطاء');
    return true;
  } catch (e) {
    console.error('فشل إرسال التنبيه:', e);
    return false;
  }
}

/**
 * فحص صحة النظام (Health Check)
 */
function healthCheck() {
  var results = {
    timestamp: new Date().toISOString(),
    status: 'OK',
    checks: {}
  };
  
  try {
    // فحص 1: الوصول للجدول
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    results.checks.spreadsheet = ss ? 'OK' : 'FAIL';
    
    // فحص 2: ورقة المحطات
    var stationsSheet = ss.getSheetByName(CONFIG.STATIONS_SHEET);
    results.checks.stationsSheet = stationsSheet ? 'OK' : 'FAIL';
    
    // فحص 3: عدد المحطات
    if (stationsSheet) {
      var stationCount = stationsSheet.getLastRow() - 1;
      results.checks.stationCount = stationCount;
    }
    
    // فحص 4: ورقة المستخدمين
    var usersSheet = ss.getSheetByName(CONFIG.USERS_SHEET);
    results.checks.usersSheet = usersSheet ? 'OK' : 'FAIL';
    
    // فحص 5: PropertiesService
    var version = PropertiesService.getScriptProperties().getProperty('DATA_VERSION');
    results.checks.propertiesService = version ? 'OK' : 'FAIL';
    
    // فحص 6: إمكانية الكتابة
    try {
      var testSheet = getOrCreateErrorLogSheet();
      results.checks.writeAccess = 'OK';
    } catch (e) {
      results.checks.writeAccess = 'FAIL';
    }
    
    // تحديد الحالة العامة
    var allChecks = Object.values(results.checks);
    if (allChecks.includes('FAIL')) {
      results.status = 'WARNING';
      logError('فحص النظام', 'بعض الفحوصات فشلت: ' + JSON.stringify(results.checks), 'النظام');
    }
    
  } catch (e) {
    results.status = 'ERROR';
    results.error = e.toString();
    logError('فحص النظام', 'فشل الفحص: ' + e.toString(), 'النظام');
  }
  
  // حفظ نتيجة آخر فحص
  PropertiesService.getScriptProperties().setProperty('LAST_HEALTH_CHECK', JSON.stringify(results));
  
  return results;
}

/**
 * إرسال التقرير اليومي
 */
function sendDailyReport() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var today = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = Utilities.formatDate(yesterday, 'Asia/Riyadh', 'yyyy-MM-dd');
    
    // إحصائيات المحطات
    var stationsSheet = ss.getSheetByName(CONFIG.STATIONS_SHEET);
    var substationsSheet = ss.getSheetByName(CONFIG.SUBSTATIONS_SHEET);
    var usersSheet = ss.getSheetByName(CONFIG.USERS_SHEET);
    var logsSheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
    var errorSheet = ss.getSheetByName(CONFIG.ERROR_LOG_SHEET);
    
    var totalStations = stationsSheet ? stationsSheet.getLastRow() - 1 : 0;
    var totalSubstations = substationsSheet ? substationsSheet.getLastRow() - 1 : 0;
    var totalUsers = usersSheet ? usersSheet.getLastRow() - 1 : 0;
    
    // إحصائيات اليوم السابق (لأن التقرير يُرسل صباحاً)
    var todayAdditions = 0;
    var todayEdits = 0;
    var todayErrors = 0;
    
    if (logsSheet) {
      var logsData = logsSheet.getDataRange().getValues();
      for (var i = 1; i < logsData.length; i++) {
        var logDate = logsData[i][5];
        if (logDate && String(logDate).indexOf(yesterdayStr) >= 0) {
          if (String(logsData[i][0]).indexOf('إضافة') >= 0) todayAdditions++;
          if (String(logsData[i][0]).indexOf('تعديل') >= 0) todayEdits++;
        }
      }
    }
    
    if (errorSheet) {
      var errorData = errorSheet.getDataRange().getValues();
      for (var j = 1; j < errorData.length; j++) {
        if (errorData[j][0] === yesterdayStr) todayErrors++;
      }
    }
    
    // إحصائيات طلبات API
    var props = PropertiesService.getScriptProperties();
    var yesterdayApiRequests = parseInt(props.getProperty('API_REQUESTS_' + yesterdayStr) || '0');
    var apiPercentage = Math.round((yesterdayApiRequests / 20000) * 100);
    
    // فحص صحة النظام
    var healthResult = healthCheck();
    
    // إنشاء التقرير
    var subject = '📊 التقرير اليومي - نظام محطات SEC - ' + yesterdayStr;
    
    var body = '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">';
    body += '<h2 style="color: #e8a54b; border-bottom: 2px solid #e8a54b; padding-bottom: 10px;">📊 التقرير اليومي</h2>';
    body += '<p style="color: #666;">تقرير يوم: ' + yesterdayStr + '</p>';
    
    // حالة النظام
    var statusColor = healthResult.status === 'OK' ? '#5cb85c' : (healthResult.status === 'WARNING' ? '#f0c36d' : '#e57373');
    body += '<div style="background: ' + statusColor + '; color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">';
    body += '<h3 style="margin: 0;">حالة النظام: ' + healthResult.status + '</h3>';
    body += '</div>';
    
    // الإحصائيات
    body += '<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">';
    body += '<tr><td colspan="2" style="background: #1e3a5f; color: white; padding: 10px; font-weight: bold;">📈 الإحصائيات العامة</td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">محطات التوزيع</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>' + totalStations + '</strong></td></tr>';
    body += '<tr><td style="padding: 8px; border: 1px solid #ddd;">محطات التحويل</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>' + totalSubstations + '</strong></td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">المستخدمين</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>' + totalUsers + '</strong></td></tr>';
    body += '</table>';
    
    body += '<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">';
    body += '<tr><td colspan="2" style="background: #5cb85c; color: white; padding: 10px; font-weight: bold;">📅 نشاط الأمس</td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">الإضافات</td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: #5cb85c;">' + todayAdditions + '</strong></td></tr>';
    body += '<tr><td style="padding: 8px; border: 1px solid #ddd;">التعديلات</td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: #f0c36d;">' + todayEdits + '</strong></td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">الأخطاء</td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: ' + (todayErrors > 0 ? '#e57373' : '#5cb85c') + ';">' + todayErrors + '</strong></td></tr>';
    body += '</table>';
    
    // إحصائيات API
    var apiColor = apiPercentage > 80 ? '#e57373' : (apiPercentage > 50 ? '#f0c36d' : '#3498db');
    body += '<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">';
    body += '<tr><td colspan="2" style="background: #3498db; color: white; padding: 10px; font-weight: bold;">📡 طلبات API</td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">طلبات الأمس</td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: ' + apiColor + ';">' + yesterdayApiRequests.toLocaleString() + '</strong></td></tr>';
    body += '<tr><td style="padding: 8px; border: 1px solid #ddd;">الحد اليومي</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>20,000</strong></td></tr>';
    body += '<tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;">نسبة الاستخدام</td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: ' + apiColor + ';">' + apiPercentage + '%</strong></td></tr>';
    body += '</table>';
    
    body += '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">';
    body += '<p style="color: #999; font-size: 11px; text-align: center;">هذا تقرير تلقائي من نظام مراقبة محطات SEC<br>يُرسل يومياً الساعة 12:00 منتصف الليل</p>';
    body += '</div>';
    
    MailApp.sendEmail({
      to: MONITORING.ADMIN_EMAIL,
      subject: subject,
      htmlBody: body
    });
    
    console.log('تم إرسال التقرير اليومي');
    return true;
  } catch (e) {
    console.error('فشل إرسال التقرير:', e);
    logError('التقرير اليومي', 'فشل الإرسال: ' + e.toString(), 'النظام');
    return false;
  }
}

/**
 * إعداد المشغلات التلقائية (Triggers)
 * يجب تشغيل هذه الدالة مرة واحدة يدوياً
 */
function setupMonitoringTriggers() {
  // حذف المشغلات القديمة
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var funcName = triggers[i].getHandlerFunction();
    if (funcName === 'healthCheck' || funcName === 'sendDailyReport') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // إنشاء مشغل الفحص الدوري (كل ساعة)
  ScriptApp.newTrigger('healthCheck')
    .timeBased()
    .everyHours(1)
    .create();
  
  // إنشاء مشغل التقرير اليومي (12 منتصف الليل)
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .inTimezone('Asia/Riyadh')
    .create();
  
  console.log('تم إعداد المشغلات بنجاح');
  
  // إرسال بريد تأكيد
  MailApp.sendEmail({
    to: MONITORING.ADMIN_EMAIL,
    subject: '✅ تم تفعيل نظام المراقبة - SEC',
    htmlBody: '<div dir="rtl" style="font-family: Arial;">' +
      '<h2 style="color: #5cb85c;">✅ تم تفعيل نظام المراقبة</h2>' +
      '<p>سيتم:</p>' +
      '<ul>' +
      '<li>فحص النظام كل ساعة</li>' +
      '<li>إرسال تقرير يومي الساعة 8 صباحاً</li>' +
      '<li>تنبيهك فوراً عند حدوث 3 أخطاء أو أكثر</li>' +
      '</ul>' +
      '</div>'
  });
  
  return 'تم الإعداد بنجاح';
}

/**
 * الحصول على حالة المراقبة
 */
function getMonitoringStatus() {
  var lastCheck = PropertiesService.getScriptProperties().getProperty('LAST_HEALTH_CHECK');
  return {
    enabled: true,
    adminEmail: MONITORING.ADMIN_EMAIL,
    lastHealthCheck: lastCheck ? JSON.parse(lastCheck) : null
  };
}

// ===================================================
// تنسيق رقم الجوال
// ===================================================
function formatPhone(phone) {
  if (!phone) return '';
  var digits = String(phone).replace(/\D/g, '');
  if (digits.indexOf('966') === 0 && digits.length === 12) digits = '0' + digits.substring(3);
  if (digits.indexOf('5') === 0 && digits.length === 9) digits = '0' + digits;
  return digits;
}

function checkPhoneValid(phone) {
  var formatted = formatPhone(phone);
  if (formatted.length !== 10) return { ok: false, msg: 'يجب 10 أرقام' };
  if (formatted.substring(0, 2) !== '05') return { ok: false, msg: 'يجب أن يبدأ بـ 05' };
  return { ok: true, phone: formatted };
}

function findUser(phoneToFind) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var searchPhone = formatPhone(phoneToFind);
  for (var i = 1; i < data.length; i++) {
    if (formatPhone(data[i][1]) === searchPhone) {
      return { name: data[i][0], phone: searchPhone, email: data[i][2] || '', type: data[i][3] || 'موظف' };
    }
  }
  return null;
}

// ===================================================
// معالجة GET
// ===================================================
function doGet(e) {
  var action = e.parameter.action;
  var result = {};
  
  // تسجيل الطلب
  recordApiRequest(action, 'GET');
  
  try {
    switch(action) {
      case 'getStations': result = getStations(); break;
      case 'getSubstations': result = getSubstations(); break;
      case 'getAllStations': result = getAllStations(); break;
      case 'searchAll': result = searchAll(e.parameter.query); break;
      case 'searchStation': result = searchAll(e.parameter.number); break;
      case 'getNearbyStations': result = getNearbyStations(e.parameter.lat, e.parameter.lng); break;
      case 'getUsers': result = getUsers(); break;
      case 'getLogs': result = getLogs(); break;
      case 'getStats': result = getStats(); break;
      case 'getDailyStats': result = getDailyStats(); break;
      case 'getAdminCode': result = getAdminCode(); break;
      case 'getContactNumber': result = getContactNumber(); break;
      case 'getSettings': result = getSettings(); break;
      case 'checkUser': result = checkUserExists(e.parameter.phone); break;
      case 'getVersion': result = { version: getDataVersion().version }; break;
      case 'getOnlineUsers': result = getOnlineUsers(); break;
      case 'getApiStats': result = getApiStats(); break;
      default: result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ===================================================
// معالجة POST
// ===================================================
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  var result = {};
  
  // تسجيل الطلب
  recordApiRequest(action, 'POST');
  
  try {
    switch(action) {
      case 'addStation': result = addStation(data); break;
      case 'addSubstation': result = addSubstation(data); break;
      case 'editStation': result = editStation(data); break;
      case 'editSubstation': result = editSubstation(data); break;
      case 'registerUser': result = registerNewUser(data); break;
      case 'loginUser': result = loginExistingUser(data); break;
      case 'updateOnline': result = updateUserOnline(data); break;
      case 'userOffline': result = setUserOffline(data); break;
      case 'recordVisit': result = recordVisit(data); break;
      default: result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ===================================================
// محطات التوزيع
// ===================================================
function getStations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.STATIONS_SHEET);
  if (!sheet) return { stations: [] };
  
  var data = sheet.getDataRange().getValues();
  var stations = [];
  
  for (var i = 1; i < data.length; i++) {
    var num = data[i][COLS.STATION_NUMBER];
    if (num !== '' && num !== null && num !== undefined) {
      stations.push({
        row: i + 1,
        type: 'distribution',
        typeLabel: 'توزيع',
        number: String(num).trim(),
        feeder: data[i][COLS.FEEDER] ? String(data[i][COLS.FEEDER]).trim() : '',
        region: data[i][COLS.REGION] ? String(data[i][COLS.REGION]).trim() : '',
        googleMap: data[i][COLS.GOOGLE_MAP] ? String(data[i][COLS.GOOGLE_MAP]).trim() : '',
        locationLink: data[i][COLS.LOCATION_LINK] ? String(data[i][COLS.LOCATION_LINK]).trim() : '',
        lat: data[i][COLS.LAT] ? String(data[i][COLS.LAT]).trim() : '',
        lng: data[i][COLS.LNG] ? String(data[i][COLS.LNG]).trim() : '',
        userName: data[i][COLS.USER_NAME] || '',
        userEmail: data[i][COLS.USER_EMAIL] || ''
      });
    }
  }
  
  return { success: true, stations: stations, count: stations.length };
}

// ===================================================
// محطات التحويل
// ===================================================
function getSubstations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SUBSTATIONS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SUBSTATIONS_SHEET);
    sheet.appendRow(['اختصار اسم محطة التحويل', 'google map', 'رابط الموقع على الطبيعة', 'خط العرض', 'خط الطول', 'التاريخ', 'الوقت', 'الاسم', 'الايميل', 'السبب']);
    sheet.getRange(1, 1, 1, 10).setBackground('#e8a54b').setFontColor('white').setFontWeight('bold');
    sheet.setFrozenRows(1);
    return { substations: [], count: 0 };
  }
  
  var data = sheet.getDataRange().getValues();
  var substations = [];
  
  for (var i = 1; i < data.length; i++) {
    var name = data[i][SUB_COLS.SHORT_NAME];
    if (name !== '' && name !== null && name !== undefined) {
      substations.push({
        row: i + 1,
        type: 'substation',
        typeLabel: 'تحويل',
        number: String(name).trim(),
        shortName: String(name).trim(),
        googleMap: data[i][SUB_COLS.GOOGLE_MAP] ? String(data[i][SUB_COLS.GOOGLE_MAP]).trim() : '',
        locationLink: data[i][SUB_COLS.LOCATION_LINK] ? String(data[i][SUB_COLS.LOCATION_LINK]).trim() : '',
        lat: data[i][SUB_COLS.LAT] ? String(data[i][SUB_COLS.LAT]).trim() : '',
        lng: data[i][SUB_COLS.LNG] ? String(data[i][SUB_COLS.LNG]).trim() : '',
        userName: data[i][SUB_COLS.USER_NAME] || '',
        userEmail: data[i][SUB_COLS.USER_EMAIL] || ''
      });
    }
  }
  
  return { success: true, substations: substations, count: substations.length };
}

// جلب الكل
function getAllStations() {
  var dist = getStations();
  var sub = getSubstations();
  var all = [];
  
  if (dist.stations) all = all.concat(dist.stations);
  if (sub.substations) all = all.concat(sub.substations);
  
  return { 
    success: true, 
    stations: all, 
    count: all.length,
    distributionCount: dist.count || 0,
    substationCount: sub.count || 0
  };
}

// البحث الشامل
function searchAll(query) {
  if (!query) return { found: false };
  var searchValue = String(query).trim().toUpperCase();
  var all = getAllStations();
  
  for (var i = 0; i < all.stations.length; i++) {
    if (String(all.stations[i].number).toUpperCase() === searchValue) {
      return { success: true, found: true, station: all.stations[i] };
    }
  }
  return { success: true, found: false };
}

// المحطات القريبة
function getNearbyStations(lat, lng) {
  if (!lat || !lng) return { stations: [] };
  var centerLat = parseFloat(lat), centerLng = parseFloat(lng), radius = 3.5;
  var all = getAllStations();
  var nearby = [];
  
  for (var i = 0; i < all.stations.length; i++) {
    var s = all.stations[i];
    if (s.lat && s.lng) {
      var dist = calcDistance(centerLat, centerLng, parseFloat(s.lat), parseFloat(s.lng));
      if (dist <= radius) {
        s.distance = dist.toFixed(2);
        nearby.push(s);
      }
    }
  }
  nearby.sort(function(a, b) { return parseFloat(a.distance) - parseFloat(b.distance); });
  return { success: true, stations: nearby, count: nearby.length };
}

function calcDistance(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===================================================
// إضافة محطة توزيع
// ===================================================
function addStation(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.STATIONS_SHEET);
    if (!sheet) {
      logError('إضافة محطة', 'ورقة المحطات غير موجودة', data.userName);
      return { error: 'ورقة المحطات غير موجودة' };
    }
    
    var check = searchAll(data.number);
    if (check.found) return { error: 'رقم المحطة موجود مسبقاً' };
    
    var now = new Date();
    var mapLink = (data.lat && data.lng) ? 'https://www.google.com/maps?q=' + data.lat + ',' + data.lng : '';
    var locLink = (data.lat && data.lng) ? data.lat + ',' + data.lng : '';
    
    sheet.appendRow([
      data.number,
      data.feeder || '',
      data.region || '',
      mapLink,
      locLink,
      data.lat || '',
      data.lng || '',
      Utilities.formatDate(now, 'Asia/Riyadh', 'dd/MM/yyyy'),
      Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss'),
      data.userName || '',
      data.userEmail || '',
      data.reason || ''
    ]);
    
    addLog('إضافة توزيع', data.number, data.userName, data.userPhone, data.reason);
    incrementDataVersion();
    return { success: true };
  } catch (e) {
    logError('إضافة محطة', 'فشل: ' + e.toString(), data.userName);
    return { error: 'فشل الحفظ: ' + e.message };
  }
}

// ===================================================
// إضافة محطة تحويل
// ===================================================
function addSubstation(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SUBSTATIONS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SUBSTATIONS_SHEET);
      sheet.appendRow(['اختصار اسم محطة التحويل', 'google map', 'رابط الموقع على الطبيعة', 'خط العرض', 'خط الطول', 'التاريخ', 'الوقت', 'الاسم', 'الايميل', 'السبب']);
      sheet.getRange(1, 1, 1, 10).setBackground('#e8a54b').setFontColor('white').setFontWeight('bold');
    }
    
    var check = searchAll(data.shortName);
    if (check.found) return { error: 'اسم المحطة موجود مسبقاً' };
    
    var now = new Date();
    var mapLink = (data.lat && data.lng) ? 'https://www.google.com/maps?q=' + data.lat + ',' + data.lng : '';
    var locLink = (data.lat && data.lng) ? data.lat + ',' + data.lng : '';
    
    sheet.appendRow([
      data.shortName,
      mapLink,
      locLink,
      data.lat || '',
      data.lng || '',
      Utilities.formatDate(now, 'Asia/Riyadh', 'dd/MM/yyyy'),
      Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss'),
      data.userName || '',
      data.userEmail || '',
      data.reason || ''
    ]);
    
    addLog('إضافة تحويل', data.shortName, data.userName, data.userPhone, data.reason);
    incrementDataVersion();
    return { success: true };
  } catch (e) {
    logError('إضافة تحويل', 'فشل: ' + e.toString(), data.userName);
    return { error: 'فشل الحفظ: ' + e.message };
  }
}

// ===================================================
// تعديل محطة توزيع
// ===================================================
function editStation(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.STATIONS_SHEET);
    if (!sheet) {
      logError('تعديل محطة', 'ورقة المحطات غير موجودة', data.userName);
      return { error: 'ورقة المحطات غير موجودة' };
    }
    
    var check = searchAll(data.number);
    if (!check.found || check.station.type !== 'distribution') return { error: 'المحطة غير موجودة' };
    
    var row = check.station.row;
    var locationChanged = false;
    
    if (data.feeder) sheet.getRange(row, COLS.FEEDER + 1).setValue(data.feeder);
    if (data.region) sheet.getRange(row, COLS.REGION + 1).setValue(data.region);
    
    if (data.lat && data.lng) {
      if (check.station.lat !== data.lat || check.station.lng !== data.lng) locationChanged = true;
      
      sheet.getRange(row, COLS.GOOGLE_MAP + 1).setValue('https://www.google.com/maps?q=' + data.lat + ',' + data.lng);
      sheet.getRange(row, COLS.LOCATION_LINK + 1).setValue(data.lat + ',' + data.lng);
      sheet.getRange(row, COLS.LAT + 1).setValue(data.lat);
      sheet.getRange(row, COLS.LNG + 1).setValue(data.lng);
      
      var now = new Date();
      sheet.getRange(row, COLS.DATE + 1).setValue(Utilities.formatDate(now, 'Asia/Riyadh', 'dd/MM/yyyy'));
      sheet.getRange(row, COLS.TIME + 1).setValue(Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss'));
      sheet.getRange(row, COLS.USER_NAME + 1).setValue(data.userName || '');
      sheet.getRange(row, COLS.USER_EMAIL + 1).setValue(data.userEmail || '');
      sheet.getRange(row, COLS.REASON + 1).setValue(data.reason || '');
    }
    
    addLog('تعديل توزيع', data.number, data.userName, data.userPhone, data.reason);
    if (locationChanged) incrementDataVersion();
    
    return { success: true };
  } catch (e) {
    logError('تعديل محطة', 'فشل: ' + e.toString(), data.userName);
    return { error: 'فشل التعديل: ' + e.message };
  }
}

// ===================================================
// تعديل محطة تحويل
// ===================================================
function editSubstation(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SUBSTATIONS_SHEET);
    if (!sheet) {
      logError('تعديل تحويل', 'ورقة المحطات غير موجودة', data.userName);
      return { error: 'ورقة المحطات غير موجودة' };
    }
    
    var check = searchAll(data.shortName);
    if (!check.found || check.station.type !== 'substation') return { error: 'المحطة غير موجودة' };
    
    var row = check.station.row;
    var locationChanged = false;
    
    if (data.lat && data.lng) {
      if (check.station.lat !== data.lat || check.station.lng !== data.lng) locationChanged = true;
      
      sheet.getRange(row, SUB_COLS.GOOGLE_MAP + 1).setValue('https://www.google.com/maps?q=' + data.lat + ',' + data.lng);
      sheet.getRange(row, SUB_COLS.LOCATION_LINK + 1).setValue(data.lat + ',' + data.lng);
      sheet.getRange(row, SUB_COLS.LAT + 1).setValue(data.lat);
      sheet.getRange(row, SUB_COLS.LNG + 1).setValue(data.lng);
      
      var now = new Date();
      sheet.getRange(row, SUB_COLS.DATE + 1).setValue(Utilities.formatDate(now, 'Asia/Riyadh', 'dd/MM/yyyy'));
      sheet.getRange(row, SUB_COLS.TIME + 1).setValue(Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss'));
      sheet.getRange(row, SUB_COLS.USER_NAME + 1).setValue(data.userName || '');
      sheet.getRange(row, SUB_COLS.USER_EMAIL + 1).setValue(data.userEmail || '');
      sheet.getRange(row, SUB_COLS.REASON + 1).setValue(data.reason || '');
    }
    
    addLog('تعديل تحويل', data.shortName, data.userName, data.userPhone, data.reason);
    if (locationChanged) incrementDataVersion();
    
    return { success: true };
  } catch (e) {
    logError('تعديل تحويل', 'فشل: ' + e.toString(), data.userName);
    return { error: 'فشل التعديل: ' + e.message };
  }
}

// ===================================================
// المستخدمين
// ===================================================
function registerNewUser(data) {
  if (!data.name || !data.phone) return { error: 'الاسم ورقم الجوال مطلوبان' };
  
  var phoneCheck = checkPhoneValid(data.phone);
  if (!phoneCheck.ok) return { error: phoneCheck.msg, invalidPhone: true };
  
  var existing = findUser(phoneCheck.phone);
  if (existing) {
    addVisit(phoneCheck.phone, existing.name);
    updateUserOnline({ phone: phoneCheck.phone, name: existing.name });
    return { success: true, alreadyExists: true, user: existing };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.USERS_SHEET);
    sheet.appendRow(['الاسم', 'رقم الجوال', 'البريد', 'النوع', 'تاريخ التسجيل']);
    sheet.getRange(1, 1, 1, 5).setBackground('#e8a54b').setFontColor('white');
  }
  
  var now = new Date().toLocaleString('ar-SA');
  sheet.appendRow([data.name.trim(), phoneCheck.phone, data.email || '', data.userType || 'موظف', now]);
  addVisit(phoneCheck.phone, data.name.trim());
  updateUserOnline({ phone: phoneCheck.phone, name: data.name.trim() });
  
  return { success: true, user: { name: data.name.trim(), phone: phoneCheck.phone, email: data.email || '', type: data.userType || 'موظف' } };
}

function loginExistingUser(data) {
  if (!data.phone) return { error: 'رقم الجوال مطلوب' };
  
  var phoneCheck = checkPhoneValid(data.phone);
  if (!phoneCheck.ok) return { error: phoneCheck.msg, invalidPhone: true };
  
  var user = findUser(phoneCheck.phone);
  if (!user) return { error: 'رقم غير مسجل', notFound: true };
  
  addVisit(phoneCheck.phone, user.name);
  updateUserOnline({ phone: phoneCheck.phone, name: user.name });
  return { success: true, user: user };
}

function checkUserExists(phone) {
  var phoneCheck = checkPhoneValid(phone);
  if (!phoneCheck.ok) return { exists: false };
  var user = findUser(phoneCheck.phone);
  return user ? { exists: true, user: user } : { exists: false };
}

// ===================================================
// سجل الزيارات - محسّن
// ===================================================
function addVisit(phone, name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.VISITS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.VISITS_SHEET);
    sheet.appendRow(['رقم الجوال', 'الاسم', 'وقت الزيارة', 'التاريخ', 'الساعة']);
    sheet.getRange(1, 1, 1, 5).setBackground('#e8a54b').setFontColor('white');
  }
  
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd');
  var timeStr = Utilities.formatDate(now, 'Asia/Riyadh', 'HH:mm:ss');
  var fullDateTime = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
  
  sheet.appendRow([phone, name, fullDateTime, dateStr, timeStr]);
  
  return { success: true };
}

function recordVisit(data) {
  if (!data.phone) return { error: 'رقم الجوال مطلوب' };
  return addVisit(data.phone, data.name || '');
}

// ===================================================
// نظام المتواجدين حالياً
// ===================================================
function getOrCreateOnlineSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.ONLINE_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ONLINE_SHEET);
    sheet.appendRow(['رقم الجوال', 'الاسم', 'آخر نشاط', 'الحالة']);
    sheet.getRange(1, 1, 1, 4).setBackground('#e8a54b').setFontColor('white');
  }
  
  return sheet;
}

function updateUserOnline(data) {
  if (!data.phone) return { error: 'رقم الجوال مطلوب' };
  
  var sheet = getOrCreateOnlineSheet();
  var dataRange = sheet.getDataRange().getValues();
  var now = new Date();
  var nowStr = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
  var found = false;
  
  // البحث عن المستخدم وتحديثه
  for (var i = 1; i < dataRange.length; i++) {
    if (formatPhone(dataRange[i][0]) === formatPhone(data.phone)) {
      sheet.getRange(i + 1, 2).setValue(data.name || dataRange[i][1]);
      sheet.getRange(i + 1, 3).setValue(nowStr);
      sheet.getRange(i + 1, 4).setValue('متصل');
      found = true;
      break;
    }
  }
  
  // إذا لم يوجد، أضفه
  if (!found) {
    sheet.appendRow([formatPhone(data.phone), data.name || '', nowStr, 'متصل']);
  }
  
  return { success: true };
}

function setUserOffline(data) {
  if (!data.phone) return { error: 'رقم الجوال مطلوب' };
  
  var sheet = getOrCreateOnlineSheet();
  var dataRange = sheet.getDataRange().getValues();
  
  for (var i = 1; i < dataRange.length; i++) {
    if (formatPhone(dataRange[i][0]) === formatPhone(data.phone)) {
      sheet.getRange(i + 1, 4).setValue('غير متصل');
      break;
    }
  }
  
  return { success: true };
}

function getOnlineUsers() {
  var sheet = getOrCreateOnlineSheet();
  var dataRange = sheet.getDataRange().getValues();
  var now = new Date();
  var onlineUsers = [];
  var ONLINE_THRESHOLD = 5 * 60 * 1000; // 5 دقائق
  
  for (var i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0] && dataRange[i][2]) {
      var lastActive = new Date(dataRange[i][2]);
      var timeDiff = now.getTime() - lastActive.getTime();
      
      if (timeDiff < ONLINE_THRESHOLD) {
        onlineUsers.push({
          phone: dataRange[i][0],
          name: dataRange[i][1],
          lastActive: dataRange[i][2],
          status: 'متصل'
        });
      }
    }
  }
  
  return { success: true, users: onlineUsers, count: onlineUsers.length };
}

function getUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sheet) return { users: [] };
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) users.push({ name: data[i][0], phone: data[i][1], email: data[i][2], type: data[i][3], registerDate: data[i][4] });
  }
  return { success: true, users: users };
}

// ===================================================
// السجلات
// ===================================================
function addLog(type, station, user, phone, reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOGS_SHEET);
    sheet.appendRow(['النوع', 'المحطة', 'المستخدم', 'الجوال', 'التاريخ', 'اليوم', 'السبب']);
    sheet.getRange(1, 1, 1, 7).setBackground('#e8a54b').setFontColor('white');
  }
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd');
  var fullDateTime = Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([type, station, user || '', phone || '', fullDateTime, dateStr, reason || '']);
}

function getLogs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  if (!sheet) return { logs: [] };
  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) logs.push({ type: data[i][0], station: data[i][1], user: data[i][2], phone: data[i][3], date: data[i][4], day: data[i][5], reason: data[i][6] });
  }
  return { success: true, logs: logs };
}

// ===================================================
// الإحصائيات
// ===================================================

// ===================================================
// الإحصائيات
// ===================================================
function getStats() {
  var dist = getStations();
  var sub = getSubstations();
  var users = getUsers();
  var logs = getLogs();
  var online = getOnlineUsers();
  
  var adds = 0, edits = 0;
  for (var i = 0; i < logs.logs.length; i++) {
    if (logs.logs[i].type.indexOf('إضافة') >= 0) adds++;
    else if (logs.logs[i].type.indexOf('تعديل') >= 0) edits++;
  }
  
  return {
    success: true,
    stats: {
      totalDistribution: dist.count || 0,
      totalSubstations: sub.count || 0,
      totalStations: (dist.count || 0) + (sub.count || 0),
      totalUsers: users.users.length,
      totalAdditions: adds,
      totalEdits: edits,
      onlineCount: online.count || 0
    }
  };
}

function getDailyStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var days = [];
  var today = new Date();
  for (var i = 6; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(Utilities.formatDate(d, 'Asia/Riyadh', 'yyyy-MM-dd'));
  }
  
  var visits = {}, adds = {}, edits = {}, userAct = {};
  
  // تهيئة الأيام
  for (var j = 0; j < days.length; j++) {
    visits[days[j]] = 0;
    adds[days[j]] = 0;
    edits[days[j]] = 0;
  }
  
  var vSheet = ss.getSheetByName(CONFIG.VISITS_SHEET);
  if (vSheet && vSheet.getLastRow() > 1) {
    var vData = vSheet.getDataRange().getValues();
    for (var i = 1; i < vData.length; i++) {
      var day = vData[i][3]; // عمود التاريخ
      if (day) {
        var dayStr = String(day);
        if (dayStr.indexOf('-') === -1 && day instanceof Date) {
          dayStr = Utilities.formatDate(day, 'Asia/Riyadh', 'yyyy-MM-dd');
        }
        if (visits[dayStr] !== undefined) {
          visits[dayStr] = (visits[dayStr] || 0) + 1;
        }
      }
    }
  }
  
  var lSheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  if (lSheet && lSheet.getLastRow() > 1) {
    var lData = lSheet.getDataRange().getValues();
    for (var i = 1; i < lData.length; i++) {
      var type = lData[i][0], user = lData[i][2], day = lData[i][5];
      if (day) {
        var dayStr = String(day);
        if (dayStr.indexOf('-') === -1 && day instanceof Date) {
          dayStr = Utilities.formatDate(day, 'Asia/Riyadh', 'yyyy-MM-dd');
        }
        if (String(type).indexOf('إضافة') >= 0 && adds[dayStr] !== undefined) {
          adds[dayStr] = (adds[dayStr] || 0) + 1;
        }
        if (String(type).indexOf('تعديل') >= 0 && edits[dayStr] !== undefined) {
          edits[dayStr] = (edits[dayStr] || 0) + 1;
        }
      }
      if (user) {
        if (!userAct[user]) userAct[user] = { additions: 0, edits: 0 };
        if (String(type).indexOf('إضافة') >= 0) userAct[user].additions++;
        if (String(type).indexOf('تعديل') >= 0) userAct[user].edits++;
      }
    }
  }
  
  var dailyVisits = days.map(function(d) { return { date: d, count: visits[d] || 0 }; });
  var dailyActivity = days.map(function(d) { return { date: d, additions: adds[d] || 0, edits: edits[d] || 0 }; });
  var topUsers = [];
  for (var u in userAct) topUsers.push({ name: u, additions: userAct[u].additions, edits: userAct[u].edits, total: userAct[u].additions + userAct[u].edits });
  topUsers.sort(function(a, b) { return b.total - a.total; });
  
  return { success: true, dailyVisits: dailyVisits, dailyActivity: dailyActivity, topUsers: topUsers.slice(0, 10) };
}

function getAdminCode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    sheet.appendRow(['الإعداد', 'القيمة']);
    sheet.appendRow(['رمز المدير', 'admin123']);
    sheet.appendRow(['إصدار البيانات', '1']);
    sheet.appendRow(['جوال التواصل', '966500000000']);
    sheet.getRange(1, 1, 1, 2).setBackground('#e8a54b').setFontColor('white');
    return { code: 'admin123' };
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'رمز المدير') {
      var code = data[i][1];
      if (code !== null && code !== undefined && String(code).trim() !== '') return { code: String(code).trim() };
    }
  }
  return { code: 'admin123' };
}

function getContactNumber() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    sheet.appendRow(['الإعداد', 'القيمة']);
    sheet.appendRow(['رمز المدير', 'admin123']);
    sheet.appendRow(['إصدار البيانات', '1']);
    sheet.appendRow(['جوال التواصل', '966500000000']);
    sheet.getRange(1, 1, 1, 2).setBackground('#e8a54b').setFontColor('white');
    return { phone: '966500000000' };
  }
  
  var data = sheet.getDataRange().getValues();
  var foundContact = false;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'جوال التواصل') {
      var phone = data[i][1];
      if (phone !== null && phone !== undefined && String(phone).trim() !== '') {
        return { phone: String(phone).trim().replace(/\D/g, '') };
      }
      foundContact = true;
    }
  }
  
  // إذا لم يوجد، أضفه
  if (!foundContact) {
    sheet.appendRow(['جوال التواصل', '966500000000']);
  }
  
  return { phone: '966500000000' };
}

function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  
  if (!sheet) {
    return { adminCode: 'admin123', contactPhone: '966500000000', version: '1' };
  }
  
  var data = sheet.getDataRange().getValues();
  var settings = { adminCode: 'admin123', contactPhone: '966500000000', version: '1' };
  
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var value = data[i][1];
    
    if (key === 'رمز المدير' && value) settings.adminCode = String(value).trim();
    if (key === 'جوال التواصل' && value) settings.contactPhone = String(value).trim().replace(/\D/g, '');
    if (key === 'إصدار البيانات' && value) settings.version = String(value).trim();
  }
  
  return settings;
}