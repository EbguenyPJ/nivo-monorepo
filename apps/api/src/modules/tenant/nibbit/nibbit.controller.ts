import { Controller, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NibbitService, ChatMessage } from './nibbit.service';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class NibbitChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

@Controller('nibbit')
@UseGuards(AuthGuard('jwt'))
export class NibbitController {
  constructor(private readonly nibbitService: NibbitService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: NibbitChatDto, @Req() req: any) {
    const tenantName = req.tenant?.name || 'Tu negocio';
    return this.nibbitService.chat(req.tenantConnection, body.messages, tenantName);
  }
}
