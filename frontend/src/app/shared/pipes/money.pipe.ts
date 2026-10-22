import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    return this.fmt.format(Number(value));
  }
}
