import { Router } from 'express';
import { createCrudController } from '../controllers/crudFactory.js';
import {
  Customer,
  Product,
  Supplier,
  Employee,
  SalesOrder,
  Invoice,
} from '../models/index.js';

const customerCtrl = createCrudController(Customer, {
  resourceName: 'Customer',
  searchFields: ['name', 'company', 'email', 'phone'],
});

const productCtrl = createCrudController(Product, {
  resourceName: 'Product',
  searchFields: ['name', 'sku', 'category'],
});

const supplierCtrl = createCrudController(Supplier, {
  resourceName: 'Supplier',
  searchFields: ['name', 'code', 'email', 'phone'],
});

const employeeCtrl = createCrudController(Employee, {
  resourceName: 'Employee',
  searchFields: ['name', 'employeeCode', 'department', 'email'],
});

const salesOrderCtrl = createCrudController(SalesOrder, {
  resourceName: 'Sales order',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
});

const invoiceCtrl = createCrudController(Invoice, {
  resourceName: 'Invoice',
  searchFields: ['legacyId', 'customerName'],
  defaultSort: { createdAt: -1 },
});

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Toys Factory ERP API v1',
    endpoints: {
      customers: '/api/v1/customers',
      products: '/api/v1/products',
      suppliers: '/api/v1/suppliers',
      employees: '/api/v1/employees',
      salesOrders: '/api/v1/sales-orders',
      invoices: '/api/v1/invoices',
    },
    seed: 'POST /api/v1/{resource}/seed — bulk sample data',
    health: '/health',
  });
});

apiRouter.get('/customers', customerCtrl.list);
apiRouter.post('/customers/seed', customerCtrl.bulkSeed);
apiRouter.get('/customers/:id', customerCtrl.getById);
apiRouter.post('/customers', customerCtrl.create);
apiRouter.put('/customers/:id', customerCtrl.update);
apiRouter.patch('/customers/:id', customerCtrl.update);
apiRouter.delete('/customers/:id', customerCtrl.remove);

apiRouter.get('/products', productCtrl.list);
apiRouter.post('/products/seed', productCtrl.bulkSeed);
apiRouter.get('/products/:id', productCtrl.getById);
apiRouter.post('/products', productCtrl.create);
apiRouter.put('/products/:id', productCtrl.update);
apiRouter.patch('/products/:id', productCtrl.update);
apiRouter.delete('/products/:id', productCtrl.remove);

apiRouter.get('/suppliers', supplierCtrl.list);
apiRouter.post('/suppliers/seed', supplierCtrl.bulkSeed);
apiRouter.get('/suppliers/:id', supplierCtrl.getById);
apiRouter.post('/suppliers', supplierCtrl.create);
apiRouter.put('/suppliers/:id', supplierCtrl.update);
apiRouter.patch('/suppliers/:id', supplierCtrl.update);
apiRouter.delete('/suppliers/:id', supplierCtrl.remove);

apiRouter.get('/employees', employeeCtrl.list);
apiRouter.post('/employees/seed', employeeCtrl.bulkSeed);
apiRouter.get('/employees/:id', employeeCtrl.getById);
apiRouter.post('/employees', employeeCtrl.create);
apiRouter.put('/employees/:id', employeeCtrl.update);
apiRouter.patch('/employees/:id', employeeCtrl.update);
apiRouter.delete('/employees/:id', employeeCtrl.remove);

apiRouter.get('/sales-orders', salesOrderCtrl.list);
apiRouter.post('/sales-orders/seed', salesOrderCtrl.bulkSeed);
apiRouter.get('/sales-orders/:id', salesOrderCtrl.getById);
apiRouter.post('/sales-orders', salesOrderCtrl.create);
apiRouter.put('/sales-orders/:id', salesOrderCtrl.update);
apiRouter.patch('/sales-orders/:id', salesOrderCtrl.update);
apiRouter.delete('/sales-orders/:id', salesOrderCtrl.remove);

apiRouter.get('/invoices', invoiceCtrl.list);
apiRouter.post('/invoices/seed', invoiceCtrl.bulkSeed);
apiRouter.get('/invoices/:id', invoiceCtrl.getById);
apiRouter.post('/invoices', invoiceCtrl.create);
apiRouter.put('/invoices/:id', invoiceCtrl.update);
apiRouter.patch('/invoices/:id', invoiceCtrl.update);
apiRouter.delete('/invoices/:id', invoiceCtrl.remove);
