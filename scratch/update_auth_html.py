filePath = r'd:\JImmy Golden\frontend-desktop\src\renderer\views\auth\index.html'

with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """            <button type="submit" class="btn-primary" id="submitBtn" data-i18n="auth.loginBtn">دخول</button>
            <div id="status" class="status"></div>
        </form>
    </div>"""

replacement = """            <button type="submit" class="btn-primary" id="submitBtn" data-i18n="auth.loginBtn">دخول</button>
            <div class="forgot-password-link" style="text-align: center; margin-top: 15px;">
                <a href="#" id="forgotPasswordBtn" style="color: #64748b; font-size: 13px; text-decoration: none;">هل نسيت كلمة المرور؟</a>
            </div>
            <div id="status" class="status"></div>
        </form>
    </div>
    <div id="recoveryModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
        <div style="background: var(--card-bg, #ffffff); border-radius: 12px; width: 90%; max-width: 440px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); direction: rtl; text-align: right; color: var(--text-color, #1e293b);">
            <h2 style="font-size: 18px; margin-top: 0; margin-bottom: 8px;">استرداد وتعيين كلمة المرور</h2>
            <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">أرسل رمز الاسترداد التالي للدعم الفني للحصول على كود فك القفل المؤقت لليوم:</p>
            <div style="background: #f1f5f9; padding: 10px 14px; border-radius: 8px; font-family: monospace; font-size: 15px; font-weight: bold; text-align: center; letter-spacing: 1px; color: #0f172a; margin-bottom: 16px; user-select: all;" id="recoveryChallengeText">جاري التحميل...</div>
            <div class="form-group" style="margin-bottom: 12px;">
                <label style="font-size: 13px; display: block; margin-bottom: 4px;">كود فك القفل المستلم:</label>
                <input type="text" id="recoveryCodeInput" placeholder="XXXX-XXXX" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; text-align: center; font-family: monospace; font-size: 16px; text-transform: uppercase;">
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 13px; display: block; margin-bottom: 4px;">كلمة المرور الجديدة:</label>
                <input type="password" id="recoveryNewPasswordInput" placeholder="أدخل 6 أحرف أو أكثر" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
            </div>
            <div id="recoveryStatus" style="font-size: 13px; margin-bottom: 12px; min-height: 18px;"></div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button type="button" id="closeRecoveryBtn" style="padding: 8px 16px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; cursor: pointer;">إلغاء</button>
                <button type="button" id="submitRecoveryBtn" style="padding: 8px 16px; border: none; background: #2563eb; color: #ffffff; border-radius: 6px; font-weight: bold; cursor: pointer;">تأكيد وتعيين</button>
            </div>
        </div>
    </div>"""

if '\r\n' in content:
    content = content.replace(target.replace('\n', '\r\n'), replacement.replace('\n', '\r\n'))
else:
    content = content.replace(target, replacement)

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html updated successfully!")
