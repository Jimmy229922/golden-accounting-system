
window.showNetProfitDetails = function() {
    if (!lastStats || !lastStats.profitDetails) return;
    
    let modal = document.getElementById('profitDetailsModal');
    if (modal) modal.remove();

    const p = lastStats.profitDetails;
    
    // Helper
    const m = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ?.?';

    modal = document.createElement('div');
    modal.id = 'profitDetailsModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';
    
    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(500px, 90%); padding: 0;">
            <div class="confirm-dialog-header" style="background: linear-gradient(135deg, rgba(30, 41, 59, 1), rgba(15, 23, 42, 1));     border-bottom: 2px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                <span style="font-size: 1.1rem; color: #38bdf8;"><i class="fas fa-calculator" style="margin-inline-end: 8px;"></i> ?????? ???? ????? ???????</span>
                <button onclick="document.getElementById('profitDetailsModal').remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div class="confirm-dialog-message" style="padding: 20px; font-size: 0.95rem; line-height: 1.8;">
                <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #10b981; font-size: 1rem;"><i class="fas fa-shopping-cart"></i> ?????: ???????? ???????? (????? ??????)</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#cbd5e1">?????? ????????:</span>
                        <strong style="color: #fff">${m(p.salesTotalMonth)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#ef4444">- ??????? (???????):</span>
                        <strong style="color: #ef4444">${m(p.salesReturnsTotalMonth)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;">
                        <span style="color:#38bdf8; font-weight:bold;">= ???? ????????:</span>
                        <strong style="color: #38bdf8; font-size: 1.1rem;">${m(p.salesMonth)}</strong>
                    </div>
                </div>

                <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b; font-size: 1rem;"><i class="fas fa-boxes"></i> ??????: ????? ???????? (??? ?????)</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#cbd5e1">????? ??????? ???????:</span>
                        <strong style="color: #fff">${m(p.cogsMonthSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#10b981">- ????? ?????????:</span>
                        <strong style="color: #10b981">${m(p.cogsMonthReturns)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;">
                        <span style="color:#f59e0b; font-weight:bold;">= ??????? ??????? (????????):</span>
                        <strong style="color: #f59e0b; font-size: 1.1rem;">${m(p.cogsMonth)}</strong>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1)); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 5px 0; color: #fff; font-size: 1.1rem; text-align: center;">??????? (???? ???????? - ???????)</h4>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 10px;">
                        <strong style="color: #10b981; font-size: 1.4rem;">${m(p.netProfit)}</strong>
                    </div>
                    <div style="text-align: center; margin-top: 12px; font-size: 0.8rem; color: #94a3b8; line-height: 1.5;">
                        <i class="fas fa-info-circle"></i> ???? ??? ????? "???? ????? ???????" ?? ???????? ??? ???? ??? ????????? ???????? ??????? ???????? ????? ??? ???? ???? ???? ???????.
                    </div>
                </div>
            </div>
            <div class="confirm-dialog-actions" style="border-top: 1px solid rgba(255,255,255,0.05); padding: 15px 20px; text-align: center; display: block;">
                <button onclick="document.getElementById('profitDetailsModal').remove()" class="confirm-dialog-btn confirm" style="width: 100%; max-width: 200px;">????? ?????</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.remove();
    });
};
