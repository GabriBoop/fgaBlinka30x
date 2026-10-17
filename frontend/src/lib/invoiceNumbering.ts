import type { Invoice } from '../types'

const STANDARD_NUMBER = /^([A-Z])(\d{3})$/i
const SEQUENCES_PER_LETTER = 1000
const MAX_SEQUENCE = 26 * SEQUENCES_PER_LETTER - 1

function parseSequence(invoiceNumber: string | null): number | null {
  if (!invoiceNumber) return null
  const match = invoiceNumber.trim().match(STANDARD_NUMBER)
  if (!match) return null
  return (match[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)) * SEQUENCES_PER_LETTER
    + Number(match[2])
}

export function isStandardInvoiceNumber(invoiceNumber: string | null | undefined): boolean {
  return Boolean(invoiceNumber && STANDARD_NUMBER.test(invoiceNumber.trim()))
}

export function nextInvoiceNumber(invoices: Invoice[], currentInvoiceId?: string): string {
  const otherInvoices = invoices.filter((invoice) => invoice.id !== currentInvoiceId)
  const sequences = otherInvoices
    .map((invoice) => parseSequence(invoice.invoice_number))
    .filter((sequence): sequence is number => sequence !== null)
  const nextSequence = sequences.length
    ? sequences.reduce((highest, sequence) => Math.max(highest, sequence), -1) + 1
    : otherInvoices.length
  if (nextSequence > MAX_SEQUENCE) return ''

  const letter = String.fromCharCode('A'.charCodeAt(0) + Math.floor(nextSequence / SEQUENCES_PER_LETTER))
  const number = String(nextSequence % SEQUENCES_PER_LETTER).padStart(3, '0')
  return `${letter}${number}`
}
