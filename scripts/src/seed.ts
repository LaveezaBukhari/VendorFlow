import { db, usersTable, vendorsTable, purchaseOrdersTable, inventoryTable, notificationsTable, tenantsTable, workflowRulesTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding VendorFlow...");

  // Tenant
  await db.insert(tenantsTable).values({ id: 1, name: "Acme Corp", slug: "acme", plan: "enterprise" }).onConflictDoNothing();
  console.log("Tenant seeded");

  // Users
  const hash = await bcrypt.hash("password", 12);
  const [user] = await db.insert(usersTable).values({
    email: "john@acme.com",
    name: "John Mitchell",
    passwordHash: hash,
    role: "company_admin",
    tenantId: 1,
  }).onConflictDoNothing().returning();
  console.log("Users seeded");

  // Workflow rules
  await db.insert(workflowRulesTable).values([
    {
      tenantId: 1,
      name: "Standard Approval",
      description: "Single-stage approval for orders under $10,000",
      minAmount: "0",
      maxAmount: "10000",
      stages: [{ name: "Manager Approval", approverRoles: ["finance_officer", "company_admin"], timeoutHours: 48 }],
      isActive: true,
    },
    {
      tenantId: 1,
      name: "Large Order Approval",
      description: "Two-stage approval for orders over $10,000",
      minAmount: "10000",
      maxAmount: null,
      stages: [
        { name: "Finance Review", approverRoles: ["finance_officer"], timeoutHours: 24 },
        { name: "Executive Approval", approverRoles: ["company_admin"], timeoutHours: 48 },
      ],
      isActive: true,
    },
  ]).onConflictDoNothing();
  console.log("Workflow rules seeded");

  // Vendors
  const vendors = await db.insert(vendorsTable).values([
    { tenantId: 1, name: "TechParts Global", email: "procurement@techparts.com", phone: "+1-555-0101", address: "500 Industrial Blvd, Austin, TX 78701", category: "Electronics", rating: "4.8", riskScore: 15, totalSpent: "285400.00", status: "active" },
    { tenantId: 1, name: "Metalworks Supply Co.", email: "orders@metalworks.com", phone: "+1-555-0102", address: "200 Steel Ave, Pittsburgh, PA 15222", category: "Manufacturing", rating: "4.5", riskScore: 22, totalSpent: "142800.00", status: "active" },
    { tenantId: 1, name: "Office Depot Pro", email: "b2b@officedepotpro.com", phone: "+1-555-0103", address: "1000 Commerce Dr, Chicago, IL 60601", category: "Office Supplies", rating: "4.2", riskScore: 10, totalSpent: "31500.00", status: "active" },
    { tenantId: 1, name: "ChemCorp Solutions", email: "enterprise@chemcorp.com", phone: "+1-555-0104", address: "750 Chemical Pkwy, Houston, TX 77001", category: "Chemicals", rating: "4.6", riskScore: 35, totalSpent: "98200.00", status: "active" },
    { tenantId: 1, name: "LogiFreight Ltd.", email: "accounts@logifreight.com", phone: "+1-555-0105", address: "300 Port Rd, Los Angeles, CA 90001", category: "Logistics", rating: "3.9", riskScore: 45, totalSpent: "54700.00", status: "inactive" },
    { tenantId: 1, name: "BuildRight Materials", email: "sales@buildright.com", phone: "+1-555-0106", address: "175 Construction Way, Dallas, TX 75201", category: "Construction", rating: "4.3", riskScore: 20, totalSpent: "210000.00", status: "active" },
  ]).onConflictDoNothing().returning();
  console.log(`Vendors seeded: ${vendors.length}`);

  if (vendors.length === 0) {
    console.log("Already seeded");
    return;
  }

  const [v1, v2, v3, v4, v5, v6] = vendors;
  const userId = user?.id ?? 1;

  // Purchase Orders
  await db.insert(purchaseOrdersTable).values([
    {
      tenantId: 1, poNumber: "PO-2026-1001", vendorId: v1.id,
      items: [
        { id: 1, description: "Industrial Microcontrollers", quantity: 500, unitPrice: 24.99, total: 12495, category: "Electronics" },
        { id: 2, description: "PCB Assembly Boards", quantity: 200, unitPrice: 89.50, total: 17900, category: "Electronics" },
      ],
      totalAmount: "30395.00", status: "approved", priority: "high",
      notes: "Rush order for Q2 production line",
      dueDate: new Date("2026-06-15"), createdBy: userId,
      approvalHistory: [
        { status: "submitted", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-01T10:00:00Z" },
        { status: "approved", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-02T14:30:00Z", notes: "Approved for Q2 production" },
      ],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1002", vendorId: v2.id,
      items: [
        { id: 1, description: "Steel Alloy Sheets (4mm)", quantity: 1000, unitPrice: 45.00, total: 45000, category: "Metal" },
        { id: 2, description: "Aluminum Extrusion Profiles", quantity: 250, unitPrice: 32.00, total: 8000, category: "Metal" },
      ],
      totalAmount: "53000.00", status: "submitted", priority: "normal",
      notes: "Quarterly structural materials replenishment",
      dueDate: new Date("2026-07-01"), createdBy: userId,
      approvalHistory: [
        { status: "submitted", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-05T09:15:00Z" },
      ],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1003", vendorId: v3.id,
      items: [
        { id: 1, description: "Office Paper (case)", quantity: 50, unitPrice: 42.99, total: 2149.50, category: "Stationery" },
        { id: 2, description: "Toner Cartridges HP", quantity: 20, unitPrice: 89.00, total: 1780, category: "Peripherals" },
      ],
      totalAmount: "3929.50", status: "received", priority: "low",
      dueDate: new Date("2026-05-20"), createdBy: userId, approvalHistory: [],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1004", vendorId: v4.id,
      items: [{ id: 1, description: "Industrial Solvent Grade A", quantity: 100, unitPrice: 125.00, total: 12500, category: "Chemicals" }],
      totalAmount: "12500.00", status: "draft", priority: "normal",
      notes: "Pending safety compliance approval",
      dueDate: new Date("2026-08-15"), createdBy: userId, approvalHistory: [],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1005", vendorId: v6.id,
      items: [
        { id: 1, description: "Reinforced Concrete Mix", quantity: 200, unitPrice: 180.00, total: 36000, category: "Construction" },
        { id: 2, description: "Steel Rebar Bundle", quantity: 50, unitPrice: 420.00, total: 21000, category: "Construction" },
      ],
      totalAmount: "57000.00", status: "approved", priority: "urgent",
      dueDate: new Date("2026-09-01"), createdBy: userId,
      approvalHistory: [
        { status: "submitted", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-03T11:00:00Z" },
        { status: "approved", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-04T16:00:00Z" },
      ],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1006", vendorId: v1.id,
      items: [{ id: 1, description: "Sensor Arrays (IMU)", quantity: 150, unitPrice: 67.50, total: 10125, category: "Electronics" }],
      totalAmount: "10125.00", status: "rejected", priority: "normal",
      rejectionReason: "Exceeded budget allocation for Q2",
      notes: "Rejected — re-submit in Q3",
      dueDate: new Date("2026-06-30"), createdBy: userId,
      approvalHistory: [
        { status: "submitted", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-06T08:00:00Z" },
        { status: "rejected", userId, userEmail: "john@acme.com", role: "company_admin", timestamp: "2026-05-07T10:00:00Z", rejectionReason: "Exceeded budget allocation for Q2" },
      ],
    },
    {
      tenantId: 1, poNumber: "PO-2026-1007", vendorId: v2.id,
      items: [{ id: 1, description: "Precision CNC Parts", quantity: 75, unitPrice: 340.00, total: 25500, category: "Manufacturing" }],
      totalAmount: "25500.00", status: "draft", priority: "high",
      dueDate: new Date("2026-07-20"), createdBy: userId, approvalHistory: [],
    },
  ]).onConflictDoNothing();
  console.log("Purchase orders seeded");

  // Inventory
  await db.insert(inventoryTable).values([
    { tenantId: 1, sku: "EL-MCU-001", name: "Industrial Microcontrollers", description: "32-bit ARM microcontrollers for automation systems", quantity: "320", reorderLevel: "100", warehouseLocation: "A-101", unitCost: "24.99", category: "Electronics", vendorId: v1.id },
    { tenantId: 1, sku: "EL-PCB-002", name: "PCB Assembly Boards", description: "Multi-layer PCBs for control systems", quantity: "85", reorderLevel: "50", warehouseLocation: "A-102", unitCost: "89.50", category: "Electronics", vendorId: v1.id },
    { tenantId: 1, sku: "MT-SAS-001", name: "Steel Alloy Sheets 4mm", description: "High-tensile steel alloy sheets", quantity: "45", reorderLevel: "200", warehouseLocation: "B-201", unitCost: "45.00", category: "Metal", vendorId: v2.id },
    { tenantId: 1, sku: "MT-AEP-002", name: "Aluminum Extrusion Profiles", description: "T-slot aluminum extrusion", quantity: "180", reorderLevel: "50", warehouseLocation: "B-202", unitCost: "32.00", category: "Metal", vendorId: v2.id },
    { tenantId: 1, sku: "CH-SOL-001", name: "Industrial Solvent Grade A", description: "High-purity industrial cleaning solvent", quantity: "8", reorderLevel: "20", warehouseLocation: "C-301", unitCost: "125.00", category: "Chemicals", vendorId: v4.id },
    { tenantId: 1, sku: "OF-PAP-001", name: "Office Paper (case)", description: "A4 80gsm premium office paper", quantity: "42", reorderLevel: "10", warehouseLocation: "D-401", unitCost: "42.99", category: "Office Supplies", vendorId: v3.id },
    { tenantId: 1, sku: "EL-SEN-003", name: "IMU Sensor Arrays", description: "6-axis inertial measurement units", quantity: "95", reorderLevel: "30", warehouseLocation: "A-103", unitCost: "67.50", category: "Electronics", vendorId: v1.id },
    { tenantId: 1, sku: "CN-RCM-001", name: "Reinforced Concrete Mix", description: "High-strength concrete mix grade 30", quantity: "12", reorderLevel: "50", warehouseLocation: "E-501", unitCost: "180.00", category: "Construction", vendorId: v6.id },
    { tenantId: 1, sku: "MT-RBR-001", name: "Steel Rebar Bundles", description: "Grade 60 steel rebar for structural use", quantity: "28", reorderLevel: "20", warehouseLocation: "B-203", unitCost: "420.00", category: "Metal", vendorId: v6.id },
    { tenantId: 1, sku: "OF-TNR-001", name: "Toner Cartridges HP", description: "Compatible HP LaserJet toner cartridges", quantity: "15", reorderLevel: "5", warehouseLocation: "D-402", unitCost: "89.00", category: "Office Supplies", vendorId: v3.id },
    { tenantId: 1, sku: "EL-CAP-004", name: "Electrolytic Capacitors 470uF", description: "High-temp electrolytic capacitors for power supplies", quantity: "2200", reorderLevel: "500", warehouseLocation: "A-104", unitCost: "0.45", category: "Electronics", vendorId: v1.id },
    { tenantId: 1, sku: "MT-BWL-003", name: "M8 Hex Bolts (box of 100)", description: "Grade 8.8 zinc-plated M8 hex bolts", quantity: "18", reorderLevel: "25", warehouseLocation: "B-204", unitCost: "28.50", category: "Fasteners", vendorId: v2.id },
  ]).onConflictDoNothing();
  console.log("Inventory seeded");

  // Notifications
  await db.insert(notificationsTable).values([
    { tenantId: 1, userId: userId, type: "low_stock", title: "Critical Stock Alert", message: "Industrial Solvent Grade A is critically low (8 units, reorder at 20). Place order immediately.", read: false, relatedEntityId: "5", relatedEntityType: "InventoryItem" },
    { tenantId: 1, userId: userId, type: "low_stock", title: "Low Stock Alert", message: "Steel Alloy Sheets 4mm is below reorder level (45 units, reorder at 200).", read: false, relatedEntityId: "3", relatedEntityType: "InventoryItem" },
    { tenantId: 1, userId: userId, type: "approval_needed", title: "Approval Required", message: "PO-2026-1002 from Metalworks Supply Co. ($53,000) is awaiting your approval.", read: false, relatedEntityId: "2", relatedEntityType: "PurchaseOrder" },
    { tenantId: 1, userId: userId, type: "order_approved", title: "Order Approved", message: "PO-2026-1001 from TechParts Global ($30,395) has been approved.", read: true, relatedEntityId: "1", relatedEntityType: "PurchaseOrder" },
    { tenantId: 1, userId: userId, type: "order_rejected", title: "Order Rejected", message: "PO-2026-1006 has been rejected: Exceeded budget allocation for Q2.", read: false, relatedEntityId: "6", relatedEntityType: "PurchaseOrder" },
    { tenantId: 1, userId: userId, type: "low_stock", title: "Low Stock Alert", message: "M8 Hex Bolts are below reorder level (18 boxes, reorder at 25).", read: false, relatedEntityId: "12", relatedEntityType: "InventoryItem" },
  ]).onConflictDoNothing();
  console.log("Notifications seeded");

  console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
