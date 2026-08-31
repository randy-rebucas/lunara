import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PartnerExpense, PartnerExpenseDocument } from './schemas/partner-expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class PartnerExpensesService {
  constructor(
    @InjectModel(PartnerExpense.name) private partnerExpenseModel: Model<PartnerExpenseDocument>,
  ) {}

  async listExpenses(partnerUserId: string) {
    const expenses = await this.partnerExpenseModel
      .find({ partnerUserId: new Types.ObjectId(partnerUserId) })
      .sort({ date: -1 })
      .limit(200);
    return { success: true, data: expenses };
  }

  async createExpense(partnerUserId: string, dto: CreateExpenseDto) {
    const expense = await this.partnerExpenseModel.create({
      partnerUserId: new Types.ObjectId(partnerUserId),
      category: dto.category,
      amount: dto.amount,
      date: new Date(dto.date),
      note: dto.note,
    });
    return { success: true, data: expense };
  }

  private async getOwnExpenseOrThrow(partnerUserId: string, expenseId: string) {
    const expense = await this.partnerExpenseModel.findOne({
      _id: expenseId,
      partnerUserId: new Types.ObjectId(partnerUserId),
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async updateExpense(partnerUserId: string, expenseId: string, dto: UpdateExpenseDto) {
    const expense = await this.getOwnExpenseOrThrow(partnerUserId, expenseId);
    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.date !== undefined) expense.date = new Date(dto.date);
    if (dto.note !== undefined) expense.note = dto.note;
    await expense.save();
    return { success: true, data: expense };
  }

  async deleteExpense(partnerUserId: string, expenseId: string) {
    const result = await this.partnerExpenseModel.deleteOne({
      _id: expenseId,
      partnerUserId: new Types.ObjectId(partnerUserId),
    });
    if (result.deletedCount === 0) throw new NotFoundException('Expense not found');
    return { success: true };
  }
}
