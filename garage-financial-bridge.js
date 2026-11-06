/* =====================================================
   C.W.B SYSTEM
   GARAGE FINANCIAL BRIDGE
   Connect Garage payments to Financial Summary
===================================================== */

(function () {
  "use strict";

  let garagePayments = [];

  const db =
    window.cwbSupabaseClient ||
    window.supabaseClient;

  // Read Garage activities from Supabase.
  async function loadGaragePayments() {

    if (!db) {
      throw new Error("Supabase connection not available.");
    }

    const { data, error } = await db
      .from("Garage_jobs")
      .select("*");

    if (error) {
      throw error;
    }

    garagePayments = data || [];

    return garagePayments;
  }

  // Calculate only money actually received.
  function calculateGarageRevenue() {

    const salesInvoices = new Set(
      (
        typeof sales !== "undefined"
          ? sales
          : []
      )
        .map(row =>
          String(row.invoice || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );

    return garagePayments.reduce((sum, row) => {

      const invoice = String(
        row.invoice_number ||
        row.Invoice_number ||
        ""
      )
        .trim()
        .toLowerCase();

      // Do not count an invoice already registered in Sales.
      if (invoice && salesInvoices.has(invoice)) {
        return sum;
      }

      const status = String(
        row.Payment_status || ""
      )
        .trim()
        .toLowerCase()
        .replace(/[_-]/g, " ");

      const total =
        Number(row.final_coast) ||
        Number(row.Job_cost) ||
        Number(row.cost) ||
        Number(row.estimated_cost) ||
        0;

      const paid = Math.max(
        0,
        Number(row.paid_amount) || 0
      );

      let received = 0;

      if (status === "paid") {

        // Paid means the full invoice amount.
        received = Math.max(0, total);

      } else if (status === "partially paid") {

        // Count only the amount actually received.
        received = Math.min(
          Math.max(0, total) || paid,
          paid
        );

      } else {

        // Unpaid and unknown statuses count as zero.
        received = 0;
      }

      return sum + received;

    }, 0);
  }

  // Preserve the existing Financial Summary calculations.
  const originalTotals = window.totals;

  if (typeof originalTotals !== "function") {
    console.error(
      "C.W.B: Original totals() function was not found."
    );
    return;
  }

  window.totals = function () {

    const result = originalTotals();

    const garageRevenue = calculateGarageRevenue();

    const combinedSales =
      result.sales + garageRevenue;

    const operating =
      combinedSales -
      result.purchases -
      result.expenses;

    const finalBalance =
      operating - result.payroll;

    return {
      ...result,
      sales: combinedSales,
      operating: operating,
      final: finalBalance
    };
  };

  // Reload Garage financial information and update the screen.
  window.cwbLoadGarageFinancials = async function () {

    await loadGaragePayments();

    if (typeof window.updateDashboard === "function") {
      window.updateDashboard();
    }

    if (typeof window.loadReports === "function") {
      window.loadReports();
    }

    return true;
  };

  // Complete Financial Report refresh.
  window.refreshFinancialReports = async function () {

    const button = document.getElementById(
      "refreshFinancialReportBtn"
    );

    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }

    try {

      if (typeof window.loadSales !== "function") {
        throw new Error("Sales loader not found.");
      }

      const salesLoaded = await window.loadSales();

      if (salesLoaded === false) {
        throw new Error(
          "Sales could not be loaded from Supabase."
        );
      }

      await loadGaragePayments();

      if (
        typeof window.loadPayrollFromSupabase === "function"
      ) {

        const payrollLoaded =
          await window.loadPayrollFromSupabase();

        if (payrollLoaded === false) {
          throw new Error(
            "Payroll could not be loaded from Supabase."
          );
        }
      }

      if (typeof window.updateDashboard === "function") {
        window.updateDashboard();
      }

      if (typeof window.loadReports === "function") {
        window.loadReports();
      }

      if (button) {
        button.textContent = "✅ REPORT UPDATED";
      }

    } catch (error) {

      console.error(
        "C.W.B Financial Report error:",
        error
      );

      const result = document.getElementById("reportResult");

      if (result) {
        result.textContent =
          "Unable to refresh financial data: " +
          error.message;
      }

      if (button) {
        button.textContent = "❌ REFRESH FAILED";
      }

    } finally {

      if (button) {
        button.disabled = false;
      }
    }
  };

  console.log(
    "C.W.B Garage Financial Bridge loaded."
  );

})();
