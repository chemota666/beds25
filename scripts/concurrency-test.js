/**
 * Concurrency test for invoice generation endpoint.
 * Tests: multiple concurrent /invoices/generate requests should not create duplicate invoices.
 */

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'roomflow',
  password: 'roomflow123',
  database: 'roomflow_pms'
});

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

const apiCall = async (method, endpoint, body = null) => {
  const url = `http://127.0.0.1:3003${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    throw err;
  }
};

const runConcurrencyTest = async () => {
  try {
    log('=== Concurrency Test: Multiple Invoice Generations ===');

    // Create owner
    const ownerRes = await apiCall('POST', '/owners', {
      name: 'CONCURRENT_TEST_OWNER',
      dni: '99999999',
      phone: '+1234567890',
      lastInvoiceNumber: 0
    });
    const ownerId = ownerRes.id;
    log(`✓ Created owner ${ownerId}`);

    // Create property
    const propRes = await apiCall('POST', '/properties', {
      name: 'CONCURRENT_PROP',
      address: 'Test Address',
      city: 'Test City',
      owner: String(ownerId),
      numRooms: 2
    });
    const propId = propRes.id;
    log(`✓ Created property ${propId}`);

    // Create room
    const roomRes = await apiCall('POST', '/rooms', {
      propertyId: String(propId),
      name: 'Habitación 1'
    });
    const roomId = roomRes.id;
    log(`✓ Created room ${roomId}`);

    // Create guest
    const guestRes = await apiCall('POST', '/guests', {
      name: 'CONCURRENT_GUEST',
      email: 'test@concurrent.com'
    });
    const guestId = guestRes.id;
    log(`✓ Created guest ${guestId}`);

    // Create reservation
    const resRes = await apiCall('POST', '/reservations', {
      reservationNumber: 0,
      propertyId: String(propId),
      roomId: roomId,
      guestId: guestId,
      price: '100.00',
      startDate: '2026-02-15',
      endDate: '2026-02-16',
      paymentMethod: 'pending'
    });
    const reservationId = resRes.id;
    log(`✓ Created reservation ${reservationId}`);

    // Run 5 concurrent invoice generation requests to the same reservation
    log('Starting 5 concurrent /invoices/generate requests...');
    const concurrentRequests = [];
    for (let i = 0; i < 5; i++) {
      concurrentRequests.push(
        apiCall('GET', `/invoices/generate?reservationId=${reservationId}`)
          .then(result => ({ success: true, result, index: i }))
          .catch(err => ({ success: false, error: err.message, index: i }))
      );
    }

    const results = await Promise.all(concurrentRequests);

    let successCount = 0;
    let errorCount = 0;
    let invoiceNumbers = [];

    for (const res of results) {
      if (res.success) {
        successCount++;
        invoiceNumbers.push(res.result.invoiceNumber);
        log(`  [${res.index}] SUCCESS: ${res.result.invoiceNumber}`);
      } else {
        errorCount++;
        log(`  [${res.index}] ERROR: ${res.error}`);
      }
    }

    log('');
    log('=== Concurrency Test Results ===');
    log(`Successful requests: ${successCount}`);
    log(`Failed requests: ${errorCount}`);
    log(`Unique invoice numbers generated: ${new Set(invoiceNumbers).size}`);

    // Validate: exactly 1 should succeed (first one) and 4 should fail with "already has invoice"
    const uniqueNumbers = new Set(invoiceNumbers);
    if (uniqueNumbers.size === 1 && successCount === 1 && errorCount === 4) {
      log('✓ PASS: Concurrency protection working correctly');
      log(`  - First request got invoice: ${invoiceNumbers[0]}`);
      log(`  - Other 4 requests correctly rejected (already has invoice)`);
      return { pass: true, invoiceNumber: invoiceNumbers[0] };
    } else {
      log('✗ FAIL: Unexpected concurrency behavior');
      log(`  Expected: 1 success, 4 failures with same invoice`);
      log(`  Got: ${successCount} successes, ${errorCount} failures, ${uniqueNumbers.size} unique invoices`);
      return { pass: false };
    }
  } catch (err) {
    log(`Test error: ${err.message}`);
    return { pass: false };
  }
};

// Run additional test: verify invoice number increments on new reservations
const runIncrementTest = async () => {
  try {
    log('');
    log('=== Increment Test: Invoice Numbers Increment Correctly ===');

    // Create owner
    const ownerRes = await apiCall('POST', '/owners', {
      name: 'INCREMENT_TEST_OWNER',
      dni: '88888888',
      phone: '+9876543210',
      lastInvoiceNumber: 0
    });
    const ownerId = ownerRes.id;
    log(`✓ Created owner ${ownerId}`);

    // Create property
    const propRes = await apiCall('POST', '/properties', {
      name: 'INCREMENT_PROP',
      address: 'Test Address',
      city: 'Test City',
      owner: String(ownerId),
      numRooms: 1
    });
    const propId = propRes.id;
    log(`✓ Created property ${propId}`);

    // Create room
    const roomRes = await apiCall('POST', '/rooms', {
      propertyId: String(propId),
      name: 'Habitación 1'
    });
    const roomId = roomRes.id;

    // Create guest
    const guestRes = await apiCall('POST', '/guests', {
      name: 'INCREMENT_GUEST',
      email: 'increment@test.com'
    });
    const guestId = guestRes.id;

    // Create and invoice 3 reservations sequentially
    const invoices = [];
    for (let i = 1; i <= 3; i++) {
      const resRes = await apiCall('POST', '/reservations', {
        reservationNumber: 0,
        propertyId: String(propId),
        roomId: roomId,
        guestId: guestId,
        price: '50.00',
        startDate: `2026-02-${20 + i}`,
        endDate: `2026-02-${21 + i}`,
        paymentMethod: 'pending'
      });

      const resId = resRes.id;
      const invRes = await apiCall('GET', `/invoices/generate?reservationId=${resId}`);
      invoices.push(invRes.invoiceNumber);
      log(`  Reservation ${i}: ${invRes.invoiceNumber}`);
    }

    // Verify sequence
    const expected = [
      `FR${String(ownerId).padStart(2, '0')}/001`,
      `FR${String(ownerId).padStart(2, '0')}/002`,
      `FR${String(ownerId).padStart(2, '0')}/003`
    ];

    if (JSON.stringify(invoices) === JSON.stringify(expected)) {
      log('✓ PASS: Invoice numbers increment correctly');
      return { pass: true };
    } else {
      log('✗ FAIL: Invoice numbers do not match expected sequence');
      log(`  Expected: ${JSON.stringify(expected)}`);
      log(`  Got: ${JSON.stringify(invoices)}`);
      return { pass: false };
    }
  } catch (err) {
    log(`Test error: ${err.message}`);
    return { pass: false };
  }
};

const main = async () => {
  const concurrencyResult = await runConcurrencyTest();
  const incrementResult = await runIncrementTest();

  log('');
  log('=== FINAL RESULTS ===');
  log(`Concurrency Test: ${concurrencyResult.pass ? '✓ PASS' : '✗ FAIL'}`);
  log(`Increment Test: ${incrementResult.pass ? '✓ PASS' : '✗ FAIL'}`);

  if (concurrencyResult.pass && incrementResult.pass) {
    log('All tests passed!');
    process.exit(0);
  } else {
    log('Some tests failed');
    process.exit(1);
  }
};

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
